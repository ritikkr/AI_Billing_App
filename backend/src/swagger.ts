import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Billing App API',
      version: '1.0.0',
      description: 'REST API for the Billing App - Invoice, Credit Notes, and Payment Management System',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
        Company: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            gstin: { type: 'string', nullable: true },
            pan: { type: 'string', nullable: true },
            state: { type: 'string' },
            stateCode: { type: 'string' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            logoUrl: { type: 'string', nullable: true },
            signatureUrl: { type: 'string', nullable: true },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            companyId: { type: 'string' },
            name: { type: 'string' },
            gstin: { type: 'string', nullable: true },
            pan: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            billingAddress: { type: 'string', nullable: true },
            shippingAddress: { type: 'string', nullable: true },
            creditLimit: { type: 'number' },
            openingBalance: { type: 'number' },
            receivableBalance: { type: 'number' },
            payableBalance: { type: 'number' },
            notes: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            companyId: { type: 'string' },
            invoiceNumber: { type: 'string' },
            invoiceDate: { type: 'string', format: 'date' },
            dueDate: { type: 'string', format: 'date', nullable: true },
            customerId: { type: 'string' },
            grandTotal: { type: 'number' },
            amountPaid: { type: 'number' },
            status: { type: 'string', enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'] },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

/**
 * Builds the OpenAPI spec for a given server URL. The server is derived from
 * the incoming request so Swagger "Try it out" calls the real deployed origin
 * instead of a hardcoded localhost. Override with PUBLIC_API_URL if the API is
 * behind a different public host than the request.
 */
export function buildSwaggerSpec(serverUrl: string) {
  return swaggerJsdoc({
    ...options,
    definition: {
      ...options.definition,
      servers: [
        {
          url: serverUrl.replace(/\/$/, ''),
          description: 'Current server',
        },
      ],
    },
  });
}

export const swaggerSpec = buildSwaggerSpec(process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`);
