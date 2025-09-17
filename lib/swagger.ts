import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PrismAI API',
      version: '2.0.0',
      description: 'PrismAI - Intelligent Business Automation Platform API. Comprehensive API for AI-powered business solutions including CRM, knowledge base, live chat, analytics, and more.',
      contact: {
        name: 'PrismAI API Support',
        email: 'support@prismai.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.prismai.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for authentication'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'JWT Bearer token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy']
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            version: {
              type: 'string'
            },
            environment: {
              type: 'string'
            },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['healthy', 'unhealthy']
                    },
                    responseTime: {
                      type: 'number'
                    },
                    error: {
                      type: 'string'
                    }
                  }
                },
                vapi: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['healthy', 'unhealthy']
                    },
                    responseTime: {
                      type: 'number'
                    },
                    error: {
                      type: 'string'
                    }
                  }
                },
                gemini: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['healthy', 'unhealthy']
                    },
                    responseTime: {
                      type: 'number'
                    },
                    error: {
                      type: 'string'
                    }
                  }
                }
              }
            },
            uptime: {
              type: 'number'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      },
      {
        BearerAuth: []
      }
    ]
  },
  apis: [
    './app/api/**/*.ts',
    './app/api/**/*.js'
  ]
};

export const specs = swaggerJSDoc(options);