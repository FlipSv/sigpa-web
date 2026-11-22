/**
 * SIGPA — API Gateway
 * Punto de Entrada y Servidor HTTP
 */
'use strict';

const app = require('./app');
const config = require('./config');

const PORT = config.port;
let server = null;

if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log('====================================================');
        console.log(`[API-GATEWAY] Enrutador Perimetral SIGPA activo`);
        console.log(`[API-GATEWAY] Escuchando en: http://localhost:${PORT}`);
        console.log(`[API-GATEWAY] Proxy Reportes: http://localhost:${PORT}/api/v1/reports/* -> ${config.services.reporting.url}`);
        console.log(`[API-GATEWAY] Proxy Core API: http://localhost:${PORT}/api/* -> ${config.services.coreApi.url}`);
        console.log(`[API-GATEWAY] Health check: http://localhost:${PORT}/health`);
        console.log('====================================================');
    });

    const shutdown = (sig) => {
        console.log(`[API-GATEWAY] Recibida señal ${sig}, cerrando servidor...`);
        server.close(() => {
            console.log('[API-GATEWAY] Servidor cerrado exitosamente.');
            process.exit(0);
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { app, server };
