import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import { runMigrations } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth, requireCompany } from './middleware/auth.js';
import { authRouter } from './routes/auth.routes.js';
import { companiesRouter } from './routes/companies.routes.js';
import { customersRouter } from './routes/customers.routes.js';
import { itemsRouter } from './routes/items.routes.js';
import { invoicesRouter } from './routes/invoices.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { creditNotesRouter } from './routes/creditNotes.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { pdfImportRouter } from './routes/pdfImport.routes.js';
import { preferencesRouter } from './routes/preferences.routes.js';
import { INDIAN_STATES, GST_RATE_SLABS, UNITS, PAYMENT_MODES } from './services/gst.constants.js';

await runMigrations();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/meta', (req, res) => {
  res.json({ states: INDIAN_STATES, gstRateSlabs: GST_RATE_SLABS, units: UNITS, paymentModes: PAYMENT_MODES });
});

app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);

// Company-scoped resources: every route below requires auth + company membership.
app.use('/api/companies/:companyId/customers', requireAuth, requireCompany, customersRouter);
app.use('/api/companies/:companyId/items', requireAuth, requireCompany, itemsRouter);
app.use('/api/companies/:companyId/invoices', requireAuth, requireCompany, invoicesRouter);
app.use('/api/companies/:companyId/payments', requireAuth, requireCompany, paymentsRouter);
app.use('/api/companies/:companyId/credit-notes', requireAuth, requireCompany, creditNotesRouter);
app.use('/api/companies/:companyId/reports', requireAuth, requireCompany, reportsRouter);
app.use('/api/companies/:companyId/pdf-import', requireAuth, requireCompany, pdfImportRouter);
app.use('/api/companies/:companyId/preferences', requireAuth, requireCompany, preferencesRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Billing API listening on http://localhost:${PORT}`);
});
