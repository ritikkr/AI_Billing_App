import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Billing App API',
      version: '1.0.0',
      description: 'REST API for the Billing App - Invoice, Credit Notes, and Payment Management System',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://api.billing-app.com',
        description: 'Production server',
      },
    ],
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

export const swaggerSpec = swaggerJsdoc(options);
