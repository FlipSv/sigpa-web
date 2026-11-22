/**
 * SIGPA — Document & Reporting Microservice
 * Punto de Entrada y Servidor HTTP
 */
'use strict';

const app = require('./app');

const PORT = parseInt(process.env.PORT || process.env.REPORTING_PORT || '5001', 10);

let server = null;

if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log('====================================================');
        console.log(`[REPORTING-SERVICE] Microservicio de Reportes activo`);
        console.log(`[REPORTING-SERVICE] Escuchando en: http://localhost:${PORT}`);
        console.log(`[REPORTING-SERVICE] Health check: http://localhost:${PORT}/api/v1/reports/health`);
        console.log(`[REPORTING-SERVICE] Documentación: http://localhost:${PORT}/api/v1/reports/docs`);
        console.log('====================================================');
    });

    const shutdown = (sig) => {
        console.log(`[REPORTING-SERVICE] Recibida señal ${sig}, cerrando servidor...`);
        server.close(() => {
            console.log('[REPORTING-SERVICE] Servidor cerrado exitosamente.');
            process.exit(0);
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { app, server };
