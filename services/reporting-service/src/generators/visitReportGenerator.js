/**
 * SIGPA — Document & Reporting Microservice
 * Generador de Informe de Visita de Seguimiento a Práctica (CU-13)
 */
'use strict';

const PDFDocument = require('pdfkit');

/**
 * Genera el buffer PDF para el informe de visita
 * @param {Object} data - Datos de la visita
 * @returns {Promise<Buffer>}
 */
function generateVisitReportPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 40, bottom: 40, left: 45, right: 45 },
                info: {
                    Title: 'SIGPA - Informe de Visita de Práctica',
                    Author: 'SIGPA Document & Reporting Service',
                    Subject: 'Evaluación de Visita de Práctica (CU-13)'
                }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            // Extraer datos con defaults seguros
            const estudiante = typeof data.estudiante === 'object' && data.estudiante !== null
                ? data.estudiante
                : { nombre: data.estudiante || 'No especificado' };

            const tutor = typeof data.tutor === 'object' && data.tutor !== null
                ? data.tutor
                : { nombre: data.tutor || 'No especificado' };

            const institucion = typeof data.institucion === 'object' && data.institucion !== null
                ? data.institucion
                : { nombre: data.institucion || 'No especificada' };

            const asesor = typeof data.asesor === 'object' && data.asesor !== null
                ? data.asesor
                : { nombre: data.asesor || 'No especificado' };

            const evaluacion = data.evaluacion || {};
            const fechaVisita = data.fecha_visita || new Date().toISOString().split('T')[0];
            const nota = evaluacion.nota !== undefined ? Number(evaluacion.nota).toFixed(1) : (data.nota ? Number(data.nota).toFixed(1) : '5.0');
            const estado = evaluacion.estado || data.estado || 'APROBADO';
            const observaciones = evaluacion.observaciones || data.observaciones || 'Visita de seguimiento y acompañamiento pedagógico completada satisfactoriamente.';
            const rubricas = Array.isArray(evaluacion.rubricas) && evaluacion.rubricas.length > 0
                ? evaluacion.rubricas
                : [
                    { criterio: 'Puntualidad, presentación y actitud profesional', calificacion: '5.0', observacion: 'Excelente compromiso y puntualidad en la jornada.' },
                    { criterio: 'Planeación didáctica y dominio disciplinar', calificacion: '4.8', observacion: 'Propuesta didáctica articulada a las necesidades del aula.' },
                    { criterio: 'Interacción pedagógica y gestión de aula con los niños', calificacion: '5.0', observacion: 'Clima de confianza, afecto y respeto con los estudiantes.' },
                    { criterio: 'Diligenciamiento de bitácoras y evidencias', calificacion: '4.7', observacion: 'Formatos al día con las horas y reflexiones consignadas.' }
                ];

            // Colores institucionales UDI
            const PRIMARY_COLOR = '#0C2340';   // Azul marino profundo institucional
            const SECONDARY_COLOR = '#0056B3'; // Azul institucional
            const ACCENT_COLOR = '#F39C12';    // Dorado / Ámbar
            const BG_LIGHT = '#F4F6F9';        // Gris claro para filas alternas
            const TEXT_DARK = '#2C3E50';

            // ── Encabezado Institucional ───────────────────────────────────────
            doc.rect(45, 40, 522, 54).fill(PRIMARY_COLOR);

            doc.fillColor('#FFFFFF')
               .fontSize(13)
               .font('Helvetica-Bold')
               .text('UNIVERSIDAD DE INVESTIGACIÓN Y DESARROLLO — UDI', 55, 48, { align: 'center', width: 502 });

            doc.fontSize(9)
               .font('Helvetica')
               .text('Facultad de Ciencias Sociales y Humanas | Licenciatura en Educación Infantil', 55, 64, { align: 'center', width: 502 });

            doc.fontSize(8)
               .font('Helvetica-Oblique')
               .text('SIGPA — Sistema Integrado de Gestión de Prácticas Académicas', 55, 78, { align: 'center', width: 502 });

            doc.y = 104;

            // ── Título del Documento ──────────────────────────────────────────
            doc.rect(45, doc.y, 522, 26).fill('#EAECEE');
            doc.fillColor(PRIMARY_COLOR)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('INFORME FORMAL DE EVALUACIÓN Y VISITA DE SEGUIMIENTO A PRÁCTICA (CU-13)', 45, doc.y + 7, { align: 'center', width: 522 });

            doc.y = 138;

            // ── Ficha de Datos Generales ─────────────────────────────────────
            const startY = doc.y;
            doc.rect(45, startY, 522, 85).strokeColor('#BDC3C7').lineWidth(1).stroke();

            // Fondo encabezado datos
            doc.rect(45, startY, 522, 18).fill(SECONDARY_COLOR);
            doc.fillColor('#FFFFFF')
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('INFORMACIÓN DE LA PRÁCTICA Y DE LA VISITA', 55, startY + 5);

            // Columnas de datos
            doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica');
            const col1 = 55;
            const col2 = 310;
            let currentY = startY + 24;

            doc.font('Helvetica-Bold').text('Estudiante:', col1, currentY);
            doc.font('Helvetica').text(estudiante.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Fecha de Visita:', col2, currentY);
            doc.font('Helvetica').text(String(fechaVisita), col2 + 85, currentY);

            currentY += 14;
            doc.font('Helvetica-Bold').text('Código / Doc:', col1, currentY);
            doc.font('Helvetica').text(estudiante.codigo || estudiante.documento || 'No registrado', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Estado Visita:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor(estado === 'APROBADO' ? '#1E8449' : '#C0392B').text(String(estado), col2 + 85, currentY);

            currentY += 14;
            doc.fillColor(TEXT_DARK);
            doc.font('Helvetica-Bold').text('Tutor UDI:', col1, currentY);
            doc.font('Helvetica').text(tutor.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Calificación:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor(PRIMARY_COLOR).text(`${nota} / 5.0`, col2 + 85, currentY);

            currentY += 14;
            doc.fillColor(TEXT_DARK);
            doc.font('Helvetica-Bold').text('Institución:', col1, currentY);
            doc.font('Helvetica').text(institucion.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Asesor In Situ:', col2, currentY);
            doc.font('Helvetica').text(asesor.nombre || 'N/A', col2 + 85, currentY);

            doc.y = startY + 95;

            // ── Tabla de Rúbricas y Criterios ────────────────────────────────
            const tableY = doc.y;
            doc.rect(45, tableY, 522, 20).fill(PRIMARY_COLOR);
            doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
            doc.text('CRITERIO DE EVALUACIÓN PEDAGÓGICA', 55, tableY + 6, { width: 220 });
            doc.text('NOTA', 285, tableY + 6, { width: 45, align: 'center' });
            doc.text('OBSERVACIONES ESPECÍFICAS', 335, tableY + 6, { width: 225 });

            let rowY = tableY + 20;
            rubricas.forEach((item, index) => {
                const isEven = index % 2 === 0;
                const rowHeight = 28;
                if (isEven) {
                    doc.rect(45, rowY, 522, rowHeight).fill(BG_LIGHT);
                }
                doc.rect(45, rowY, 522, rowHeight).strokeColor('#E0E0E0').lineWidth(0.5).stroke();

                doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
                   .text(item.criterio || `Criterio ${index + 1}`, 55, rowY + 5, { width: 220 });

                const itemNota = item.calificacion !== undefined ? Number(item.calificacion).toFixed(1) : '5.0';
                doc.fillColor(PRIMARY_COLOR).font('Helvetica-Bold')
                   .text(`${itemNota}`, 285, rowY + 9, { width: 45, align: 'center' });

                doc.fillColor(TEXT_DARK).font('Helvetica')
                   .text(item.observacion || 'Cumple a cabalidad con los lineamientos.', 335, rowY + 5, { width: 225 });

                rowY += rowHeight;
            });

            doc.y = rowY + 12;

            // ── Observaciones Generales y Concepto Pedagógico ───────────────
            const obsY = doc.y;
            doc.rect(45, obsY, 522, 18).fill(SECONDARY_COLOR);
            doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
               .text('CONCEPTO Y OBSERVACIONES GENERALES DE LA VISITA', 55, obsY + 5);

            doc.rect(45, obsY + 18, 522, 50).strokeColor('#BDC3C7').lineWidth(1).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica')
               .text(observaciones, 55, obsY + 24, { width: 502, align: 'justify' });

            doc.y = obsY + 78;

            // ── Firmas de Conformidad ───────────────────────────────────────
            const sigY = Math.max(doc.y + 15, 620);
            const sigWidth = 150;

            // Tutor UDI
            doc.strokeColor('#555555').lineWidth(1).moveTo(55, sigY).lineTo(55 + sigWidth, sigY).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
               .text(tutor.nombre || 'Tutor Académico UDI', 55, sigY + 4, { width: sigWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica')
               .text('Tutor Asignado — UDI', 55, sigY + 14, { width: sigWidth, align: 'center' });

            // Asesor In Situ
            doc.strokeColor('#555555').lineWidth(1).moveTo(230, sigY).lineTo(230 + sigWidth, sigY).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
               .text(asesor.nombre || 'Asesor In Situ', 230, sigY + 4, { width: sigWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica')
               .text('Asesor Centro de Práctica', 230, sigY + 14, { width: sigWidth, align: 'center' });

            // Estudiante
            doc.strokeColor('#555555').lineWidth(1).moveTo(405, sigY).lineTo(405 + sigWidth, sigY).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
               .text(estudiante.nombre || 'Estudiante en Formación', 405, sigY + 4, { width: sigWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica')
               .text('Estudiante Practicante', 405, sigY + 14, { width: sigWidth, align: 'center' });

            // ── Pie de Página y Sello de Verificación ───────────────────────
            const reportId = data.reportId || 'VIS-' + Date.now().toString(36).toUpperCase();
            doc.fontSize(7).font('Helvetica-Oblique').fillColor('#7F8C8D')
               .text(`Documento expedido formalmente por el Sistema SIGPA | Código de Verificación: ${reportId} | Emisión: ${new Date().toISOString()}`, 45, 735, { align: 'center', width: 522 });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateVisitReportPdf
};
