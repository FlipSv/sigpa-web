/**
 * SIGPA — Document & Reporting Microservice
 * Generador de Acta Formal de Cierre y Culminación de Práctica (CU-14 / CU-15)
 */
'use strict';

const PDFDocument = require('pdfkit');

/**
 * Genera el buffer PDF para el acta de cierre de práctica
 * @param {Object} data - Datos del cierre
 * @returns {Promise<Buffer>}
 */
function generateClosureActPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 40, bottom: 40, left: 45, right: 45 },
                info: {
                    Title: 'SIGPA - Acta de Cierre de Práctica Formativa',
                    Author: 'SIGPA Document & Reporting Service',
                    Subject: 'Acta de Culminación de Práctica (CU-14 / CU-15)'
                }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const estudiante = typeof data.estudiante === 'object' && data.estudiante !== null
                ? data.estudiante
                : { nombre: data.estudiante || 'No especificado' };

            const tutor = typeof data.tutor === 'object' && data.tutor !== null
                ? data.tutor
                : { nombre: data.tutor || 'No especificado' };

            const institucion = typeof data.institucion === 'object' && data.institucion !== null
                ? data.institucion
                : { nombre: data.institucion || 'No especificada' };

            const horasCumplidas = Number(data.horas_cumplidas !== undefined ? data.horas_cumplidas : (data.horasCumplidas !== undefined ? data.horasCumplidas : 160));
            const totalHoras = Number(data.total_horas_requeridas !== undefined ? data.total_horas_requeridas : (data.totalHorasRequeridas !== undefined ? data.totalHorasRequeridas : 160));
            const porcentaje = totalHoras > 0 ? Math.min(100, Math.round((horasCumplidas / totalHoras) * 100)) : 100;
            const notaFinal = data.nota_final !== undefined ? Number(data.nota_final).toFixed(1) : (data.notaFinal !== undefined ? Number(data.notaFinal).toFixed(1) : '5.0');
            const fechaCierre = data.fecha_cierre || data.fechaCierre || new Date().toISOString().split('T')[0];
            const avalInSitu = Boolean(data.aval_in_situ !== undefined ? data.aval_in_situ : true);
            const avalTutor = Boolean(data.aval_tutor !== undefined ? data.aval_tutor : true);

            // Colores institucionales UDI
            const PRIMARY_COLOR = '#0C2340';   // Azul marino
            const SECONDARY_COLOR = '#1E8449'; // Verde éxito
            const TEXT_DARK = '#2C3E50';
            const BG_LIGHT = '#F8F9F9';

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

            // ── Título del Acta ───────────────────────────────────────────────
            doc.rect(45, doc.y, 522, 28).fill('#E8F8F5');
            doc.fillColor('#117864')
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('ACTA FORMAL DE CIERRE Y CULMINACIÓN DE PRÁCTICA FORMATIVA (CU-14 / CU-15)', 45, doc.y + 8, { align: 'center', width: 522 });

            doc.y = 140;

            // ── Certificación y Declaración Legal ────────────────────────────
            const decY = doc.y;
            doc.rect(45, decY, 522, 48).fill(BG_LIGHT);
            doc.rect(45, decY, 522, 48).strokeColor('#BDC3C7').lineWidth(0.8).stroke();

            doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica')
               .text(
                   'Por medio de la presente, la Coordinación de Prácticas de la Licenciatura en Educación Infantil y el Comité Evaluador ' +
                   'certifican que el/la estudiante ha cumplido a cabalidad con las actividades pedagógicas, horas reglamentarias y ' +
                   'criterios de evaluación estipulados para la modalidad de práctica académica durante el período correspondiente.',
                   55, decY + 8, { width: 502, align: 'justify', lineGap: 2 }
               );

            doc.y = decY + 58;

            // ── Ficha de Información de Cierre ──────────────────────────────
            const infoY = doc.y;
            doc.rect(45, infoY, 522, 85).strokeColor('#BDC3C7').lineWidth(1).stroke();
            doc.rect(45, infoY, 522, 18).fill('#1A5276');
            doc.fillColor('#FFFFFF')
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('DATOS DE LA PRÁCTICA Y RESULTADOS FINALES', 55, infoY + 5);

            const col1 = 55;
            const col2 = 310;
            let currentY = infoY + 24;

            doc.fillColor(TEXT_DARK).fontSize(8.5);
            doc.font('Helvetica-Bold').text('Estudiante:', col1, currentY);
            doc.font('Helvetica').text(estudiante.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Fecha de Cierre:', col2, currentY);
            doc.font('Helvetica').text(String(fechaCierre), col2 + 85, currentY);

            currentY += 14;
            doc.font('Helvetica-Bold').text('Código / Doc:', col1, currentY);
            doc.font('Helvetica').text(estudiante.codigo || estudiante.documento || 'No registrado', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Horas Realizadas:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor(porcentaje >= 100 ? '#1E8449' : '#C0392B')
               .text(`${horasCumplidas} / ${totalHoras} hrs (${porcentaje}%)`, col2 + 85, currentY);

            currentY += 14;
            doc.fillColor(TEXT_DARK);
            doc.font('Helvetica-Bold').text('Tutor Académico:', col1, currentY);
            doc.font('Helvetica').text(tutor.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Calificación Final:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor('#0C2340').text(`${notaFinal} / 5.0 (APROBADO)`, col2 + 85, currentY);

            currentY += 14;
            doc.fillColor(TEXT_DARK);
            doc.font('Helvetica-Bold').text('Institución Receptora:', col1, currentY);
            doc.font('Helvetica').text(institucion.nombre || 'N/A', col1 + 105, currentY);
            doc.font('Helvetica-Bold').text('Estado:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor('#1E8449').text('CULMINADA Y APROBADA', col2 + 85, currentY);

            doc.y = infoY + 95;

            // ── Avales de Conformidad Tripartita ────────────────────────────
            const avalY = doc.y;
            doc.rect(45, avalY, 522, 18).fill('#1A5276');
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
               .text('VERIFICACIÓN DE AVALES DE CONFORMIDAD REGLAMENTARIOS', 55, avalY + 5);

            doc.rect(45, avalY + 18, 522, 45).strokeColor('#BDC3C7').lineWidth(1).stroke();

            // Aval In Situ
            doc.fillColor(TEXT_DARK).fontSize(8.5);
            doc.font('Helvetica-Bold').text('Aval Asesor In Situ (Institución):', 55, avalY + 25);
            doc.font('Helvetica-Bold').fillColor(avalInSitu ? '#1E8449' : '#C0392B')
               .text(avalInSitu ? '✔ CERTIFICADO Y APROBADO EN SEDE' : 'PENDIENTE', 230, avalY + 25);

            // Aval Tutor UDI
            doc.fillColor(TEXT_DARK);
            doc.font('Helvetica-Bold').text('Aval Tutor Académico (UDI):', 55, avalY + 42);
            doc.font('Helvetica-Bold').fillColor(avalTutor ? '#1E8449' : '#C0392B')
               .text(avalTutor ? '✔ CONVALIDADO Y AVALADO POR EL DOCENTE' : 'PENDIENTE', 230, avalY + 42);

            doc.y = avalY + 72;

            // ── Criterios Evaluativos Finales ────────────────────────────────
            const tableY = doc.y;
            doc.rect(45, tableY, 522, 20).fill(PRIMARY_COLOR);
            doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
            doc.text('COMPETENCIA PEDAGÓGICA Y DESEMPEÑO', 55, tableY + 6, { width: 330 });
            doc.text('ESTADO / CALIFICACIÓN', 390, tableY + 6, { width: 165, align: 'center' });

            const criterios = [
                { nombre: 'Cumplimiento de horas formativas en centro de práctica (100%)', estado: 'CUMPLIDO (160h)' },
                { nombre: 'Diligenciamiento continuo de bitácoras y tres momentos pedagógicos', estado: 'CUMPLIDO Y REVISADO' },
                { nombre: 'Visitas de acompañamiento y seguimiento in situ aprobadas', estado: 'APROBADO' },
                { nombre: 'Evaluación de competencias didácticas y relacionales', estado: `NOTA FINAL: ${notaFinal}` }
            ];

            let rowY = tableY + 20;
            criterios.forEach((c, idx) => {
                const isEven = idx % 2 === 0;
                const rowH = 20;
                if (isEven) doc.rect(45, rowY, 522, rowH).fill(BG_LIGHT);
                doc.rect(45, rowY, 522, rowH).strokeColor('#E0E0E0').lineWidth(0.5).stroke();

                doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica')
                   .text(c.nombre, 55, rowY + 5, { width: 330 });
                doc.fillColor('#1E8449').font('Helvetica-Bold')
                   .text(c.estado, 390, rowY + 5, { width: 165, align: 'center' });

                rowY += rowH;
            });

            doc.y = rowY + 20;

            // ── Firmas de las Partes ────────────────────────────────────────
            const sigY = Math.max(doc.y + 15, 620);
            const sigWidth = 150;

            // Tutor UDI
            doc.strokeColor('#555555').lineWidth(1).moveTo(55, sigY).lineTo(55 + sigWidth, sigY).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
               .text(tutor.nombre || 'Tutor Académico UDI', 55, sigY + 4, { width: sigWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica')
               .text('Tutor Responsable — UDI', 55, sigY + 14, { width: sigWidth, align: 'center' });

            // Asesor In Situ
            doc.strokeColor('#555555').lineWidth(1).moveTo(230, sigY).lineTo(230 + sigWidth, sigY).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
               .text(institucion.representante || 'Asesor In Situ', 230, sigY + 4, { width: sigWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica')
               .text('Asesor Centro de Práctica', 230, sigY + 14, { width: sigWidth, align: 'center' });

            // Estudiante
            doc.strokeColor('#555555').lineWidth(1).moveTo(405, sigY).lineTo(405 + sigWidth, sigY).stroke();
            doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold')
               .text(estudiante.nombre || 'Estudiante Egresado', 405, sigY + 4, { width: sigWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica')
               .text('Firma del Estudiante', 405, sigY + 14, { width: sigWidth, align: 'center' });

            // ── Pie de Página ────────────────────────────────────────────────
            const reportId = data.reportId || 'ACTA-' + Date.now().toString(36).toUpperCase();
            doc.fontSize(7).font('Helvetica-Oblique').fillColor('#7F8C8D')
               .text(`Acta Oficial SIGPA | Identificador de Registro: ${reportId} | Fecha de Registro: ${new Date().toISOString()}`, 45, 735, { align: 'center', width: 522 });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateClosureActPdf
};
