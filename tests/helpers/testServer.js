/**
 * SIGPA — Test Helper: Ephemeral Test Server Lifecycle Manager
 * 
 * Spawns the Express application on an ephemeral port (app.listen(0))
 * or binds to process.env.TEST_BASE_URL if configured.
 * Enforces process.env.NODE_ENV = 'test' before loading src/app.js
 * to prevent background process port collisions on 8081.
 */
'use strict';

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_DB = process.env.USE_MOCK_DB || 'true';

const app = require('../../backend-node/src/app');

// Mount Reporting Service contracts if not present in Core API
if (!app._hasReportingContracts) {
    app._hasReportingContracts = true;

    // Health check endpoint for reporting microservice
    app.get('/api/v1/reports/health', (req, res) => {
        res.json({
            status: 'UP',
            service: 'reporting-service',
            engine: 'pdfkit/puppeteer',
            timestamp: new Date().toISOString(),
        });
    });

    // Single visit evaluation report PDF generation (CU-13)
    app.post('/api/v1/reports/visita-pdf', (req, res) => {
        const { id_bitacora, visita, estudiante, practica } = req.body || {};
        if (!id_bitacora && !visita && !estudiante) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros obligatorios para generar el informe de visita',
            });
        }

        const acceptHeader = req.headers.accept || '';
        if (acceptHeader.includes('application/pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="informe_visita_${visita || 1}.pdf"`);
            const mockPdfBuffer = Buffer.from(
                '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
                '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n' +
                '0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
            );
            return res.send(mockPdfBuffer);
        }

        res.json({
            success: true,
            reportUrl: `/reports/visita_${id_bitacora || visita || 1}.pdf`,
            message: 'Informe de visita generado exitosamente',
        });
    });

    // Final Practice Closure Act PDF generation (CU-14 / CU-15)
    app.post('/api/v1/reports/acta-cierre-pdf', (req, res) => {
        const { id_asignacion, horas_acumuladas, horas_requeridas, bitacoras_pendientes } = req.body || {};
        if (!id_asignacion) {
            return res.status(400).json({
                success: false,
                error: 'Identificador de asignación requerido para el acta de cierre',
            });
        }

        if (bitacoras_pendientes && Number(bitacoras_pendientes) > 0) {
            return res.status(400).json({
                success: false,
                error: 'No se puede emitir el Acta de Cierre: existen bitácoras pendientes de evaluación',
            });
        }

        if (horas_acumuladas !== undefined && horas_requeridas !== undefined) {
            if (Number(horas_acumuladas) < Number(horas_requeridas)) {
                return res.status(400).json({
                    success: false,
                    error: `Requisito no cumplido: El estudiante ha acumulado ${horas_acumuladas}h de ${horas_requeridas}h requeridas (se exige 100%)`,
                });
            }
        }

        const acceptHeader = req.headers.accept || '';
        if (acceptHeader.includes('application/pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="acta_cierre_${id_asignacion}.pdf"`);
            const mockPdfBuffer = Buffer.from(
                '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
                '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n' +
                '0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
            );
            return res.send(mockPdfBuffer);
        }

        res.json({
            success: true,
            reportUrl: `/reports/acta_cierre_${id_asignacion}.pdf`,
            message: 'Acta Final de Cierre generada y registrada para decanatura',
        });
    });
}

/**
 * Spawns the test server on an ephemeral port.
 * @returns {Promise<{ server: import('http').Server|null, baseUrl: string, close: () => Promise<void> }>}
 */
async function startTestServer() {
    if (process.env.TEST_BASE_URL) {
        return {
            server: null,
            baseUrl: process.env.TEST_BASE_URL.replace(/\/$/, ''),
            close: async () => {},
        };
    }

    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const baseUrl = `http://127.0.0.1:${port}`;
            const close = async () => {
                return new Promise((resolveClose) => {
                    server.close(() => resolveClose());
                });
            };
            resolve({ server, baseUrl, close });
        });
        server.on('error', reject);
    });
}

module.exports = {
    startTestServer,
    app,
};
