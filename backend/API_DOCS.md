# API Documentation

## Swagger UI

The API documentation is available through a Swagger UI interface. Once the server is running, you can access it at:

```
http://localhost:4000/api-docs
```

## Features

- **Interactive API Explorer**: Test API endpoints directly from the browser
- **OpenAPI 3.0 Specification**: Complete API documentation following industry standards
- **Authentication**: Full JWT bearer token authentication support
- **Schema Definitions**: Detailed request/response schemas for all endpoints

## Getting Started

### 1. Start the Backend Server

```bash
npm run dev
```

The server will start on `http://localhost:4000`

### 2. Access API Documentation

Open your browser and navigate to:

```
http://localhost:4000/api-docs
```

### 3. Authentication

To test protected endpoints:

1. Register or login using the Auth endpoints
2. Copy the JWT token from the response
3. Click the "Authorize" button in Swagger UI
4. Paste the token in the format: `Bearer YOUR_TOKEN_HERE`
5. All subsequent requests will include the token

## API Endpoints Overview

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/me` - Get current user details

### Companies (`/api/companies`)
- `GET /api/companies` - List user's companies
- `POST /api/companies` - Create a new company
- `GET /api/companies/{companyId}` - Get company details
- `PATCH /api/companies/{companyId}` - Update company details

### Customers (`/api/companies/{companyId}/customers`)
- `GET /api/companies/{companyId}/customers` - List all customers
- `POST /api/companies/{companyId}/customers` - Create new customer
- `GET /api/companies/{companyId}/customers/{id}` - Get customer details
- `PATCH /api/companies/{companyId}/customers/{id}` - Update customer
- `DELETE /api/companies/{companyId}/customers/{id}` - Delete/archive customer

### Invoices (`/api/companies/{companyId}/invoices`)
- `GET /api/companies/{companyId}/invoices` - List all invoices (filter by status, customer, date, search)
- `GET /api/companies/{companyId}/invoices/summary` - Invoice summary statistics
- `GET /api/companies/{companyId}/invoices/next-number` - Preview next invoice number for a date
- `GET /api/companies/{companyId}/invoices/overdue` - List overdue invoices with aging buckets
- `POST /api/companies/{companyId}/invoices/preview` - Preview invoice totals
- `POST /api/companies/{companyId}/invoices` - Create new invoice
- `POST /api/companies/{companyId}/invoices/{id}/mark-sent` - Mark a draft invoice as sent
- `POST /api/companies/{companyId}/invoices/{id}/duplicate` - Duplicate invoice as a draft
- `POST /api/companies/{companyId}/invoices/{id}/cancel` - Cancel invoice
- `GET /api/companies/{companyId}/invoices/{id}` - Get invoice details
- `PATCH /api/companies/{companyId}/invoices/{id}` - Update invoice
- `DELETE /api/companies/{companyId}/invoices/bulk` - Bulk delete draft invoices
- `DELETE /api/companies/{companyId}/invoices/{id}` - Delete draft invoice

### Credit Notes (`/api/companies/{companyId}/credit-notes`)
- `GET /api/companies/{companyId}/credit-notes` - List all credit notes
- `POST /api/companies/{companyId}/credit-notes` - Create new credit note
- `GET /api/companies/{companyId}/credit-notes/{id}` - Get credit note details

### Payments (`/api/companies/{companyId}/payments`)
- `POST /api/companies/{companyId}/payments` - Record payment
- `GET /api/companies/{companyId}/payments` - List payments

### Items (`/api/companies/{companyId}/items`)
- `GET /api/companies/{companyId}/items` - List items
- `GET /api/companies/{companyId}/items/summary` - Item summary statistics
- `POST /api/companies/{companyId}/items` - Create item
- `POST /api/companies/{companyId}/items/bulk` - Bulk create items
- `POST /api/companies/{companyId}/items/{id}/duplicate` - Duplicate item
- `PATCH /api/companies/{companyId}/items/bulk` - Bulk update items
- `PATCH /api/companies/{companyId}/items/{id}` - Update item
- `PATCH /api/companies/{companyId}/items/{id}/stock` - Adjust item stock quantity
- `DELETE /api/companies/{companyId}/items/bulk` - Bulk delete/archive items
- `DELETE /api/companies/{companyId}/items/{id}` - Delete/archive item

### Reports (`/api/companies/{companyId}/reports`)
- `GET /api/companies/{companyId}/reports/gst-summary` - GST summary report

### Meta (`/api/meta`)
- `GET /api/meta` - Get application metadata (states, GST rates, units, payment modes)

## Common Response Codes

- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate email)
- `500` - Internal Server Error

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

## Security

- All endpoints (except `/api/auth/register`, `/api/auth/login`, and `/api/meta`) require authentication
- Use JWT Bearer tokens for authentication
- Tokens are returned from login/register endpoints
- Include token in the `Authorization` header: `Authorization: Bearer YOUR_TOKEN`

## Rate Limiting

Currently, there is no rate limiting implemented. Please use the API responsibly.

## Changelog

### Version 1.0.0
- Initial release with full CRUD operations for invoices, customers, items, and credit notes
- GST-aware invoice generation
- Payment tracking
- Multi-company support
- Role-based access control (admin, accountant, viewer)
