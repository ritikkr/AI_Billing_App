# Swagger API Documentation - Quick Start Guide

## Overview

The Billing App API now includes comprehensive Swagger/OpenAPI documentation. This guide will help you get started with accessing and testing the API.

## Installation

The required dependencies have been added to `package.json`:
- `swagger-jsdoc` - Generates OpenAPI specification from JSDoc comments
- `swagger-ui-express` - Provides interactive Swagger UI interface

Install dependencies:
```bash
npm install
```

## Starting the Server

Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:4000`

## Accessing Swagger UI

Once the server is running, open your browser and navigate to:

```
http://localhost:4000/api-docs
```

You'll see an interactive Swagger UI with all available API endpoints.

## Using the Swagger UI

### 1. Explore Endpoints
- The left sidebar shows all available endpoints grouped by tags (Auth, Companies, Customers, etc.)
- Click on any endpoint to expand it and see details

### 2. Test Endpoints
- Click "Try it out" on any endpoint
- Fill in required parameters (path, query, or body parameters)
- Click "Execute" to send the request
- View the response below

### 3. Authentication
For endpoints that require authentication:
1. First, login using `POST /api/auth/login` endpoint
2. Copy the JWT token from the response
3. Click the "Authorize" button (top right in Swagger UI)
4. Paste the token in format: `Bearer YOUR_TOKEN_HERE`
5. Click "Authorize" and close
6. All subsequent requests will include the token

### 4. View Response
- Status code is displayed prominently
- Response body shows the actual data returned
- Headers tab shows response headers
- Curl command shows how to run the request from terminal

## API Documentation Structure

### Authentication Endpoints
- Register new account
- Login with credentials
- Get current user info and company memberships

### Companies
- List your companies
- Create new company
- Update company details
- Manage members and roles

### Customers
- List, create, update, delete customers
- Filter by search, status, etc.
- View customer invoices and outstanding balance

### Invoices
- Create invoices with GST calculations
- List invoices with filtering
- Update invoice details
- Record payments
- Generate PDF (through API)

### Credit Notes
- Create credit notes
- Adjust customer balances
- Track against invoices

### Items
- Manage products and services
- Track inventory (optional)
- Set GST rates per item

### Payments
- Record customer payments
- Track payment methods
- Reconciliation support

### Reports
- GST Summary
- Financial reports
- Customer aging reports

## Example: Creating an Invoice

1. **Get your company ID**: Login and list companies
2. **Add a customer**: Use POST /api/companies/{companyId}/customers
3. **Add items**: Use POST /api/companies/{companyId}/items
4. **Preview invoice**: Use POST /api/companies/{companyId}/invoices/preview (no creation)
5. **Create invoice**: Use POST /api/companies/{companyId}/invoices with line items
6. **Download PDF**: Use GET /api/companies/{companyId}/invoices/{id}/pdf

## Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success - Request completed successfully |
| 201 | Created - Resource created successfully |
| 204 | No Content - Successful deletion |
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Missing or invalid authentication token |
| 403 | Forbidden - Authenticated but lacks permission |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists (e.g., duplicate email) |
| 500 | Server Error - Internal server error |

## Common Error Responses

```json
{
  "error": "Invalid GSTIN: Check digit mismatch"
}
```

```json
{
  "error": "Customer not found"
}
```

## Curl Examples

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### List Customers
```bash
curl -X GET "http://localhost:4000/api/companies/company-id/customers" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Customer
```bash
curl -X POST http://localhost:4000/api/companies/company-id/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "phone": "9876543210",
    "billingAddress": "123 Business Street, City, State 123456",
    "gstin": "27AABCT1234H1Z0"
  }'
```

## OpenAPI Specification

The complete OpenAPI 3.0 specification is generated from JSDoc comments in the route files:
- `src/routes/auth.routes.ts`
- `src/routes/companies.routes.ts`
- `src/routes/customers.routes.ts`
- `src/routes/invoices.routes.ts`
- `src/routes/items.routes.ts`
- And more...

Configuration is in `src/swagger.ts`

## Customizing Documentation

To add documentation to new endpoints:

1. Add JSDoc comment with `@swagger` annotation above the route handler
2. Follow OpenAPI 3.0 specification format
3. The swagger UI will automatically regenerate

Example:
```typescript
/**
 * @swagger
 * /api/companies/{companyId}/customers:
 *   post:
 *     tags:
 *       - Customers
 *     summary: Create a new customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 */
```

## Production Deployment

When deploying to production:

1. Update server URL in `src/swagger.ts`:
```typescript
servers: [
  {
    url: 'https://api.your-domain.com',
    description: 'Production server',
  },
],
```

2. Consider restricting swagger UI access to authenticated users only
3. Document any rate limits or quotas
4. Include authentication requirements

## Troubleshooting

### Swagger UI not loading
- Ensure backend server is running on port 4000
- Check browser console for errors
- Clear browser cache and reload

### Endpoints not showing in Swagger
- Verify JSDoc comments are correctly formatted
- Check that routes are properly imported in `src/index.ts`
- Restart the development server

### Authentication issues
- Ensure token format is `Bearer YOUR_TOKEN` (with space)
- Check token hasn't expired
- Verify user has required permissions for the action

## Additional Resources

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc GitHub](https://github.com/Surnet/swagger-jsdoc)

## Support

For issues with the API documentation:
1. Check the API_DOCS.md file for endpoint reference
2. Review JSDoc comments in route files for implementation details
3. Test endpoints directly in Swagger UI with various parameters
