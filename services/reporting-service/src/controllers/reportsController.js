/**
 * SIGPA — Document & Reporting Microservice
 * Controlador Principal de Generación y Gestión de Reportes
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const StorageManager = require('../storage/storageManager');
const { generateVisitReportPdf } = require('../generators/visitReportGenerator');
const { generateClosureActPdf } = require('../generators/closureActGenerator');

const storageManager = new StorageManager();

/**
 * Health Check del Microservicio de Reportes
 */
function getHealth(req, res) {
    res.json({
        status: 'UP',
        service: 'reporting-service',
        engine: 'pdfkit',
        timestamp: new Date().toISOString(),
        storage: {
            totalReports: storageManager.count(),
            directory: storageManager.storageDir
        }
    });
}

/**
 * Documentación de la API (OpenAPI JSON o vista HTML interactiva)
 */
function getDocs(req, res) {
    const docsPath = path.resolve(__dirname, '../docs/openapi.json');
    let spec = {};
    if (fs.existsSync(docsPath)) {
        try {
            spec = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
        } catch (e) {
            spec = { error: 'No se pudo cargar la especificación OpenAPI' };
        }
    }

    const acceptsHtml = req.headers['accept'] && req.headers['accept'].includes('text/html');
    if (acceptsHtml && req.query.format !== 'json') {
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>SIGPA — Document & Reporting Service API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; background: #F8F9FA; color: #212529; }
    .container { max-width: 900px; margin: 0 auto; background: #FFF; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { color: #0C2340; border-bottom: 2px solid #0C2340; padding-bottom: 8px; margin-top: 0; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .post { background: #28a745; color: white; }
    .get { background: #007bff; color: white; }
    .endpoint { margin: 16px 0; padding: 16px; border: 1px solid #E9ECEF; border-radius: 6px; background: #FDFDFD; }
    .endpoint h3 { margin: 0 0 8px 0; font-family: monospace; font-size: 15px; }
    pre { background: #272822; color: #F8F8F2; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SIGPA — Document & Reporting Microservice</h1>
    <p>Microservicio independiente de generación de reportes y actas en formato PDF para el Sistema de Gestión de Prácticas Académicas (UDI).</p>
    <p><strong>Motor de Renderizado:</strong> PDFKit (Pure JavaScript Deterministic Engine)</p>

    <div class="endpoint">
      <h3><span class="badge get">GET</span> /api/v1/reports/health</h3>
      <p>Verifica la disponibilidad del microservicio y métricas del almacenamiento desacoplado.</p>
    </div>

    <div class="endpoint">
      <h3><span class="badge post">POST</span> /api/v1/reports/visita-pdf</h3>
      <p>Genera el Informe Formal de Evaluación y Visita a Práctica Pedagógica (CU-13).</p>
      <p><em>Retorna: Binary PDF o JSON con metadatos según cabecera <code>Accept</code> o parámetro <code>?format=json</code>.</em></p>
    </div>

    <div class="endpoint">
      <h3><span class="badge post">POST</span> /api/v1/reports/acta-cierre-pdf</h3>
      <p>Genera el Acta Formal de Cierre y Culminación de Práctica (CU-14 / CU-15).</p>
      <p><em>Retorna: Binary PDF o JSON con metadatos según cabecera <code>Accept</code> o parámetro <code>?format=json</code>.</em></p>
    </div>

    <div class="endpoint">
      <h3><span class="badge get">GET</span> /api/v1/reports/:id</h3>
      <p>Recupera un reporte previamente generado y almacenado por su UUID.</p>
    </div>

    <div class="endpoint">
      <h3><span class="badge get">GET</span> /api/v1/reports/docs</h3>
      <p>Especificación OpenAPI 3.0 completa (pasar cabecera <code>Accept: application/json</code> o <code>?format=json</code>).</p>
    </div>
  </div>
</body>
</html>`;
        return res.send(html);
    }

    return res.json(spec);
}

/**
 * Genera el informe de visita en PDF (CU-13)
 */
async function generateVisitaPdf(req, res, next) {
    try {
        const data = req.body || {};
        if (!data.estudiante || !data.tutor || !data.institucion) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros obligatorios ausentes: estudiante, tutor e institucion son requeridos'
            });
        }

        const reportId = crypto.randomUUID();
        const filename = `informe-visita-${reportId.slice(0, 8)}.pdf`;

        const pdfBuffer = await generateVisitReportPdf({
            ...data,
            reportId
        });

        const stored = await storageManager.saveReport({
            type: 'VISITA',
            reportId,
            filename,
            buffer: pdfBuffer,
            metadata: {
                estudiante: typeof data.estudiante === 'object' ? data.estudiante.nombre : data.estudiante,
                tutor: typeof data.tutor === 'object' ? data.tutor.nombre : data.tutor,
                institucion: typeof data.institucion === 'object' ? data.institucion.nombre : data.institucion,
                fecha: data.fecha_visita || new Date().toISOString().split('T')[0],
                nota: data.evaluacion?.nota !== undefined ? Number(data.evaluacion.nota) : (data.nota !== undefined ? Number(data.nota) : 5.0)
            }
        });

        // Determinar formato de respuesta según Accept o parámetro format
        const wantsJson = (req.headers['accept'] && req.headers['accept'].includes('application/json')) ||
                          req.query.format === 'json' ||
                          req.body.format === 'json';

        if (wantsJson) {
            return res.status(200).json({
                success: true,
                reportId: stored.id,
                filename: stored.filename,
                url: stored.url,
                size: stored.size,
                createdAt: stored.createdAt
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${stored.filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('x-report-id', stored.id);
        return res.status(200).send(pdfBuffer);
    } catch (err) {
        console.error('[REPORT-SERVICE] Error generando informe de visita:', err);
        return res.status(500).json({
            success: false,
            error: 'Error interno generando informe de visita: ' + err.message
        });
    }
}

/**
 * Genera el acta formal de cierre de práctica en PDF (CU-14 / CU-15)
 */
async function generateActaCierrePdf(req, res, next) {
    try {
        const data = req.body || {};
        if (!data.estudiante || !data.tutor || !data.institucion) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros obligatorios ausentes: estudiante, tutor e institucion son requeridos'
            });
        }

        const reportId = crypto.randomUUID();
        const filename = `acta-cierre-${reportId.slice(0, 8)}.pdf`;

        const pdfBuffer = await generateClosureActPdf({
            ...data,
            reportId
        });

        const stored = await storageManager.saveReport({
            type: 'ACTA_CIERRE',
            reportId,
            filename,
            buffer: pdfBuffer,
            metadata: {
                estudiante: typeof data.estudiante === 'object' ? data.estudiante.nombre : data.estudiante,
                tutor: typeof data.tutor === 'object' ? data.tutor.nombre : data.tutor,
                institucion: typeof data.institucion === 'object' ? data.institucion.nombre : data.institucion,
                horas_cumplidas: data.horas_cumplidas !== undefined ? Number(data.horas_cumplidas) : 160,
                total_horas_requeridas: data.total_horas_requeridas !== undefined ? Number(data.total_horas_requeridas) : 160,
                nota_final: data.nota_final !== undefined ? Number(data.nota_final) : 5.0,
                fecha: data.fecha_cierre || new Date().toISOString().split('T')[0]
            }
        });

        const wantsJson = (req.headers['accept'] && req.headers['accept'].includes('application/json')) ||
                          req.query.format === 'json' ||
                          req.body.format === 'json';

        if (wantsJson) {
            return res.status(200).json({
                success: true,
                reportId: stored.id,
                filename: stored.filename,
                url: stored.url,
                size: stored.size,
                createdAt: stored.createdAt
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${stored.filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('x-report-id', stored.id);
        return res.status(200).send(pdfBuffer);
    } catch (err) {
        console.error('[REPORT-SERVICE] Error generando acta de cierre:', err);
        return res.status(500).json({
            success: false,
            error: 'Error interno generando acta de cierre: ' + err.message
        });
    }
}

/**
 * Recupera un reporte almacenado por su ID
 */
function getReportById(req, res) {
    try {
        const { id } = req.params;
        const report = storageManager.getReportById(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: `Reporte con id '${id}' no encontrado en almacenamiento desacoplado`
            });
        }

        const wantsJson = (req.headers['accept'] && req.headers['accept'].includes('application/json')) ||
                          req.query.meta === 'true' ||
                          req.query.format === 'json';

        if (wantsJson) {
            return res.status(200).json({
                success: true,
                report: {
                    id: report.id,
                    filename: report.filename,
                    type: report.type,
                    size: report.size,
                    createdAt: report.createdAt,
                    metadata: report.metadata,
                    url: `/api/v1/reports/${report.id}`
                }
            });
        }

        const buffer = storageManager.getReportBuffer(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${report.filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('x-report-id', report.id);
        return res.status(200).send(buffer);
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: 'Error al recuperar reporte: ' + err.message
        });
    }
}

/**
 * Lista todos los reportes almacenados
 */
function listReports(req, res) {
    const list = storageManager.listReports();
    res.json({
        success: true,
        total: list.length,
        reports: list
    });
}

module.exports = {
    getHealth,
    getDocs,
    generateVisitaPdf,
    generateActaCierrePdf,
    getReportById,
    listReports,
    storageManager
};
