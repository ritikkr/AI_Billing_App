================================================================================
                     API DOCUMENTATION - SWAGGER UI
================================================================================

Your Billing App API now has comprehensive Swagger documentation!

🚀 QUICK START:
   1. npm install
   2. npm run dev
   3. Open: http://localhost:4000/api-docs

📚 DOCUMENTATION FILES:
   • SWAGGER_SETUP.md  - Complete setup overview
   • SWAGGER_GUIDE.md  - How to use Swagger UI
   • API_DOCS.md       - API endpoint reference

✨ FEATURES:
   ✓ Interactive endpoint testing
   ✓ Full OpenAPI 3.0 specification
   ✓ JWT Bearer authentication support
   ✓ Request/response examples
   ✓ Error documentation

🔐 TO AUTHENTICATE:
   1. Login via POST /api/auth/login
   2. Copy the JWT token
   3. Click "Authorize" in Swagger UI
   4. Paste: Bearer YOUR_TOKEN_HERE

📝 SUPPORTED ENDPOINTS:
   • Authentication (register, login, user info)
   • Companies (list, create, update)
   • Customers (CRUD operations)
   • Invoices (create, list, update, delete)
   • Items (products & services)
   • Credit Notes
   • Payments
   • Reports

🛠️ TO ADD DOCUMENTATION TO NEW ENDPOINTS:
   Add JSDoc @swagger comments to your route handlers
   Swagger UI regenerates automatically

📖 LEARN MORE:
   Read SWAGGER_GUIDE.md for detailed instructions

================================================================================
