import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

/**
 * @swagger
 * tags:
 *   - name: Items
 *     description: Product/Service items management
 */

export const itemsRouter = Router({ mergeParams: true });

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  hsnSacCode: z.string().optional().nullable(),
  itemType: z.enum(['goods', 'service']).optional(),
  unit: z.string().optional(),
  salePrice: z.number().min(0),
  purchasePrice: z.number().optional().nullable(),
  gstRate: z.number().min(0).max(100),
  stockQty: z.number().optional().nullable(),
  trackInventory: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

function rowToItem(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    hsnSacCode: row.hsn_sac_code,
    itemType: row.item_type,
    unit: row.unit,
    salePrice: row.sale_price,
    purchasePrice: row.purchase_price,
    gstRate: row.gst_rate,
    stockQty: row.stock_qty,
    trackInventory: !!row.track_inventory,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

itemsRouter.get(
  '/',
  /**
   * @swagger
   * /api/companies/{companyId}/items:
   *   get:
   *     tags:
   *       - Items
   *     summary: List all items
   *     parameters:
   *       - name: companyId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *       - name: search
   *         in: query
   *         schema:
   *           type: string
   *         description: Search by name or HSN/SAC code
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of items
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   itemType:
   *                     type: string
   *                     enum: [goods, service]
   *                   gstRate:
   *                     type: number
   *                   salePrice:
   *                     type: number
   *                   unit:
   *                     type: string
   */
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || '';
    const rows = db
      .prepare(`SELECT * FROM items WHERE company_id = ? AND (name LIKE ? OR hsn_sac_code LIKE ?) ORDER BY name`)
      .all(req.companyId, `%${search}%`, `%${search}%`);
    res.json(rows.map(rowToItem));
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/items/summary:
 *   get:
 *     tags:
 *       - Items
 *     summary: Item summary statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated item statistics
 */
itemsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const totals = db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN item_type = 'goods' THEN 1 ELSE 0 END) as goods,
           SUM(CASE WHEN item_type = 'service' THEN 1 ELSE 0 END) as services,
           SUM(CASE WHEN track_inventory = 1 AND stock_qty IS NOT NULL THEN stock_qty ELSE 0 END) as stockUnits
         FROM items WHERE company_id = ?`
      )
      .get(req.companyId) as any;

    const tracked = db
      .prepare(`SELECT stock_qty, sale_price, purchase_price FROM items WHERE company_id = ? AND track_inventory = 1`)
      .all(req.companyId) as any[];

    const lowStockThreshold = Number(req.query.lowStockThreshold) || 10;
    const stockValue = tracked.reduce((sum, i) => sum + (i.stock_qty || 0) * (i.purchase_price || 0), 0);
    const saleStockValue = tracked.reduce((sum, i) => sum + (i.stock_qty || 0) * (i.sale_price || 0), 0);
    const lowStock = tracked.filter((i) => (i.stock_qty || 0) <= lowStockThreshold).length;

    res.json({
      totalItems: totals.total || 0,
      activeItems: totals.active || 0,
      inactiveItems: (totals.total || 0) - (totals.active || 0),
      goodsCount: totals.goods || 0,
      serviceCount: totals.services || 0,
      stockUnits: Math.round((totals.stockUnits || 0) * 100) / 100,
      stockValue: Math.round((stockValue + Number.EPSILON) * 100) / 100,
      saleStockValue: Math.round((saleStockValue + Number.EPSILON) * 100) / 100,
      lowStockCount: lowStock,
      lowStockThreshold,
    });
  })
);

itemsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = db.prepare(`SELECT * FROM items WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId);
    if (!row) throw new ApiError(404, 'Item not found');
    res.json(rowToItem(row));
  })
);

itemsRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = itemSchema.parse(req.body);
    const id = newId();
    db.prepare(
      `INSERT INTO items (id, company_id, name, description, hsn_sac_code, item_type, unit, sale_price,
        purchase_price, gst_rate, stock_qty, track_inventory)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      req.companyId,
      body.name,
      body.description || null,
      body.hsnSacCode || null,
      body.itemType || 'goods',
      body.unit || 'NOS',
      body.salePrice,
      body.purchasePrice ?? null,
      body.gstRate,
      body.stockQty ?? null,
      body.trackInventory ? 1 : 0
    );
    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id);
    res.status(201).json(rowToItem(row));
  })
);

const bulkSchema = z.object({
  items: z.array(itemSchema).min(1).max(1000),
});

/**
 * @swagger
 * /api/companies/{companyId}/items/bulk:
 *   post:
 *     tags:
 *       - Items
 *     summary: Bulk create items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name, salePrice, gstRate]
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     hsnSacCode:
 *                       type: string
 *                     itemType:
 *                       type: string
 *                       enum: [goods, service]
 *                     unit:
 *                       type: string
 *                     salePrice:
 *                       type: number
 *                     purchasePrice:
 *                       type: number
 *                     gstRate:
 *                       type: number
 *                     stockQty:
 *                       type: number
 *                     trackInventory:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Items created
 */
itemsRouter.post(
  '/bulk',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = bulkSchema.parse(req.body);
    const insert = db.prepare(
      `INSERT INTO items (id, company_id, name, description, hsn_sac_code, item_type, unit, sale_price,
        purchase_price, gst_rate, stock_qty, track_inventory)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    const fetch = db.prepare(`SELECT * FROM items WHERE id = ?`);
    const created = db.transaction(() => {
      return body.items.map((it) => {
        const id = newId();
        insert.run(
          id,
          req.companyId,
          it.name,
          it.description || null,
          it.hsnSacCode || null,
          it.itemType || 'goods',
          it.unit || 'NOS',
          it.salePrice,
          it.purchasePrice ?? null,
          it.gstRate,
          it.stockQty ?? null,
          it.trackInventory ? 1 : 0
        );
        return rowToItem(fetch.get(id));
      });
    })();
    res.status(201).json(created);
  })
);

// Keep specific paths like /bulk before :id routes so they are not shadowed.
itemsRouter.post(
  '/:id/duplicate',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = db
      .prepare(`SELECT * FROM items WHERE id = ? AND company_id = ?`)
      .get(req.params.id, req.companyId) as any;
    if (!current) throw new ApiError(404, 'Item not found');

    const id = newId();
    db.prepare(
      `INSERT INTO items (id, company_id, name, description, hsn_sac_code, item_type, unit, sale_price,
        purchase_price, gst_rate, stock_qty, track_inventory, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      req.companyId,
      `${current.name} (Copy)`,
      current.description,
      current.hsn_sac_code,
      current.item_type,
      current.unit,
      current.sale_price,
      current.purchase_price,
      current.gst_rate,
      current.stock_qty,
      current.track_inventory,
      current.is_active
    );
    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id);
    res.status(201).json(rowToItem(row));
  })
);

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  data: itemSchema.partial(),
});

/**
 * @swagger
 * /api/companies/{companyId}/items/bulk:
 *   patch:
 *     tags:
 *       - Items
 *     summary: Bulk update items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, data]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated items
 */
itemsRouter.patch(
  '/bulk',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = bulkUpdateSchema.parse(req.body);
    const b = body.data;

    const placeholders = body.ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM items WHERE id IN (${placeholders}) AND company_id = ?`)
      .all(...body.ids, req.companyId) as any[];
    if (rows.length === 0) throw new ApiError(404, 'No items found');

    const update = db.prepare(
      `UPDATE items SET name=?, description=?, hsn_sac_code=?, item_type=?, unit=?, sale_price=?,
       purchase_price=?, gst_rate=?, stock_qty=?, track_inventory=?, is_active=?, updated_at=datetime('now')
       WHERE id=? AND company_id=?`
    );
    const fetch = db.prepare(`SELECT * FROM items WHERE id = ?`);

    const updated = db.transaction(() => {
      return rows.map((current: any) => {
        const m = {
          name: b.name ?? current.name,
          description: b.description ?? current.description,
          hsn_sac_code: b.hsnSacCode ?? current.hsn_sac_code,
          item_type: b.itemType ?? current.item_type,
          unit: b.unit ?? current.unit,
          sale_price: b.salePrice ?? current.sale_price,
          purchase_price: b.purchasePrice ?? current.purchase_price,
          gst_rate: b.gstRate ?? current.gst_rate,
          stock_qty: b.stockQty ?? current.stock_qty,
          track_inventory:
            b.trackInventory === undefined ? current.track_inventory : b.trackInventory ? 1 : 0,
          is_active: b.isActive === undefined ? current.is_active : b.isActive ? 1 : 0,
        };
        update.run(
          m.name, m.description, m.hsn_sac_code, m.item_type, m.unit, m.sale_price, m.purchase_price,
          m.gst_rate, m.stock_qty, m.track_inventory, m.is_active, current.id, req.companyId
        );
        return rowToItem(fetch.get(current.id));
      });
    })();
    res.json({ updated: updated.length, items: updated });
  })
);

itemsRouter.patch(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = itemSchema.partial().parse(req.body);
    const current = db.prepare(`SELECT * FROM items WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId) as any;
    if (!current) throw new ApiError(404, 'Item not found');

    const m = {
      name: body.name ?? current.name,
      description: body.description ?? current.description,
      hsn_sac_code: body.hsnSacCode ?? current.hsn_sac_code,
      item_type: body.itemType ?? current.item_type,
      unit: body.unit ?? current.unit,
      sale_price: body.salePrice ?? current.sale_price,
      purchase_price: body.purchasePrice ?? current.purchase_price,
      gst_rate: body.gstRate ?? current.gst_rate,
      stock_qty: body.stockQty ?? current.stock_qty,
      track_inventory: body.trackInventory === undefined ? current.track_inventory : body.trackInventory ? 1 : 0,
      is_active: body.isActive === undefined ? current.is_active : body.isActive ? 1 : 0,
    };

    db.prepare(
      `UPDATE items SET name=?, description=?, hsn_sac_code=?, item_type=?, unit=?, sale_price=?,
       purchase_price=?, gst_rate=?, stock_qty=?, track_inventory=?, is_active=?, updated_at=datetime('now')
       WHERE id=? AND company_id=?`
    ).run(
      m.name, m.description, m.hsn_sac_code, m.item_type, m.unit, m.sale_price, m.purchase_price,
      m.gst_rate, m.stock_qty, m.track_inventory, m.is_active, req.params.id, req.companyId
    );

    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(req.params.id);
    res.json(rowToItem(row));
  })
);

const stockSchema = z.object({
  stockQty: z.number(),
  mode: z.enum(['set', 'increase', 'decrease']).optional().default('set'),
  reason: z.string().optional(),
});

/**
 * @swagger
 * /api/companies/{companyId}/items/{id}/stock:
 *   patch:
 *     tags:
 *       - Items
 *     summary: Adjust item stock quantity
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stockQty]
 *             properties:
 *               stockQty:
 *                 type: number
 *               mode:
 *                 type: string
 *                 enum: [set, increase, decrease]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated item with new stock
 *       400:
 *         description: Item does not track inventory
 *       404:
 *         description: Item not found
 */
itemsRouter.patch(
  '/:id/stock',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = stockSchema.parse(req.body);
    const current = db
      .prepare(`SELECT * FROM items WHERE id = ? AND company_id = ?`)
      .get(req.params.id, req.companyId) as any;
    if (!current) throw new ApiError(404, 'Item not found');
    if (!current.track_inventory) {
      throw new ApiError(400, 'Item does not track inventory; enable trackInventory first');
    }

    const base = current.stock_qty || 0;
    const nextQty =
      body.mode === 'increase'
        ? base + body.stockQty
        : body.mode === 'decrease'
          ? base - body.stockQty
          : body.stockQty;

    db.prepare(`UPDATE items SET stock_qty = ?, updated_at = datetime('now') WHERE id=? AND company_id=?`).run(
      nextQty,
      req.params.id,
      req.companyId
    );
    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(req.params.id);
    res.json({ ...rowToItem(row), previousStockQty: base, adjustmentMode: body.mode, reason: body.reason || null });
  })
);

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(1000),
});

/**
 * @swagger
 * /api/companies/{companyId}/items/bulk:
 *   delete:
 *     tags:
 *       - Items
 *     summary: Bulk delete or archive items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Result with deleted/archived counts
 */
itemsRouter.delete(
  '/bulk',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = bulkDeleteSchema.parse(req.body);
    const dels: string[] = [];
    const archives: string[] = [];
    const missing: string[] = [];

    const archiver = db.prepare(
      `UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id=? AND company_id=?`
    );
    const remover = db.prepare(`DELETE FROM items WHERE id = ? AND company_id = ?`);

    db.transaction(() => {
      for (const id of body.ids) {
        const row = db
          .prepare(`SELECT id, is_active FROM items WHERE id = ? AND company_id = ?`)
          .get(id, req.companyId) as any;
        if (!row) {
          missing.push(id);
          continue;
        }
        const used = db.prepare(`SELECT COUNT(*) as n FROM invoice_items WHERE item_id = ?`).get(id) as any;
        if (used.n > 0) {
          archiver.run(id, req.companyId);
          archives.push(id);
        } else {
          remover.run(id, req.companyId);
          dels.push(id);
        }
      }
    })();

    res.json({
      deleted: dels,
      archived: archives,
      archivedCount: archives.length,
      deletedCount: dels.length,
      notFound: missing,
    });
  })
);

itemsRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const used = db.prepare(`SELECT COUNT(*) as n FROM invoice_items WHERE item_id = ?`).get(req.params.id) as any;
    if (used.n > 0) {
      db.prepare(`UPDATE items SET is_active = 0, updated_at=datetime('now') WHERE id=? AND company_id=?`).run(
        req.params.id,
        req.companyId
      );
      return res.json({ archived: true });
    }
    db.prepare(`DELETE FROM items WHERE id = ? AND company_id = ?`).run(req.params.id, req.companyId);
    res.status(204).send();
  })
);
