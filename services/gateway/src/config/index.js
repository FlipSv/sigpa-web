/**
 * SIGPA — API Gateway
 * Configuración del Gateway y Servicios Downstream
 */
'use strict';

const config = {
    port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || '3000', 10),
    jwtSecrets: [
        process.env.JWT_SECRET,
        'sigpa_secret_key_2026',
        'sigpa_udi_secret_key_2026_super_segura'
    ].filter(Boolean),
    services: {
        reporting: {
            url: process.env.REPORTING_SERVICE_URL || 'http://localhost:5001',
            healthPath: '/api/v1/reports/health'
        },
        coreApi: {
            url: process.env.CORE_API_URL || 'http://localhost:5000',
            healthPath: '/api/test-db'
        }
    },
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-user-id', 'x-user-role', 'x-requested-with']
    }
};

module.exports = config;
