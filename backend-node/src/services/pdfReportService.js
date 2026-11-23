/**
 * SIGPA — Servicio de Generación de Documentos y Reportes Oficiales en PDF
 * Universidad de Investigación y Desarrollo (UDI)
 * Licenciatura en Educación Infantil
 */
'use strict';

const PDFDocument = require('pdfkit');

// Constantes institucionales de diseño
const COLOR_PRIMARY = '#0C2340';   // Azul marino institucional UDI
const COLOR_SECONDARY = '#1A5276'; // Azul medio institucional
const COLOR_ACCENT = '#D4AF37';    // Dorado institucional
const COLOR_SUCCESS = '#1E8449';   // Verde cumplimiento
const COLOR_WARNING = '#D35400';   // Naranja / Advertencia
const COLOR_DANGER = '#C0392B';    // Rojo rezagado
const COLOR_TEXT = '#2C3E50';
const COLOR_MUTED = '#7F8C8D';
const COLOR_BG_LIGHT = '#F8F9FA';
const COLOR_BORDER = '#BDC3C7';

/**
 * Agrega el encabezado institucional formal de la UDI
 */
function agregarEncabezadoInstitucional(doc, tituloReporte, subtitulo) {
    const pageWidth = doc.page.width;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Barra superior institucional
    doc.rect(margin, margin, contentWidth, 52).fill(COLOR_PRIMARY);

    // Franja dorada de acento
    doc.rect(margin, margin + 52, contentWidth, 3).fill(COLOR_ACCENT);

    doc.fillColor('#FFFFFF')
       .fontSize(12.5)
       .font('Helvetica-Bold')
       .text('UNIVERSIDAD DE INVESTIGACIÓN Y DESARROLLO — UDI', margin, margin + 8, {
           align: 'center',
           width: contentWidth
       });

    doc.fontSize(8.5)
       .font('Helvetica')
       .text('Facultad de Ciencias Sociales y Humanas | Licenciatura en Educación Infantil', margin, margin + 24, {
           align: 'center',
           width: contentWidth
       });

    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .fillColor('#E0E6ED')
       .text('SIGPA — Sistema Integral de Gestión de Prácticas Académicas', margin, margin + 37, {
           align: 'center',
           width: contentWidth
       });

    doc.y = margin + 64;

    // Título del documento
    doc.rect(margin, doc.y, contentWidth, 26).fill('#EAECEE');
    doc.fillColor(COLOR_PRIMARY)
       .fontSize(10.5)
       .font('Helvetica-Bold')
       .text(tituloReporte.toUpperCase(), margin, doc.y + 7, {
           align: 'center',
           width: contentWidth
       });

    doc.y += 32;

    if (subtitulo) {
        doc.fillColor(COLOR_MUTED)
           .fontSize(8)
           .font('Helvetica-Oblique')
           .text(subtitulo, margin, doc.y, { align: 'center', width: contentWidth });
        doc.y += 14;
    }
}

/**
 * Agrega el pie de página institucional con numeración y sello
 */
function agregarPiePagina(doc) {
    const range = doc.bufferedPageRange();
    const margin = 40;
    const contentWidth = doc.page.width - (margin * 2);

    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const y = doc.page.height - 35;

        doc.rect(margin, y, contentWidth, 0.5).fill(COLOR_BORDER);

        doc.fillColor(COLOR_MUTED)
           .fontSize(7.5)
           .font('Helvetica')
           .text('Documento Oficial SIGPA · Sistema de Aseguramiento de Calidad Académica UDI · Lineamientos MEN / Decreto 1075', margin, y + 6, {
               align: 'left',
               width: contentWidth - 80
           });

        doc.text(`Página ${i + 1} de ${range.count}`, doc.page.width - margin - 70, y + 6, {
            align: 'right',
            width: 70
        });
    }
}

/**
 * Dibuja un bloque de métricas clave (KPIs)
 */
function dibujarKpiBoxes(doc, boxes, startY) {
    const margin = 40;
    const pageWidth = doc.page.width;
    const totalWidth = pageWidth - (margin * 2);
    const boxCount = boxes.length;
    const gap = 10;
    const boxWidth = (totalWidth - (gap * (boxCount - 1))) / boxCount;
    const boxHeight = 44;

    boxes.forEach((box, index) => {
        const x = margin + index * (boxWidth + gap);
        doc.rect(x, startY, boxWidth, boxHeight).fill(COLOR_BG_LIGHT);
        doc.rect(x, startY, boxWidth, boxHeight).strokeColor(COLOR_BORDER).lineWidth(0.8).stroke();

        // Barra lateral de color
        doc.rect(x, startY, 4, boxHeight).fill(box.color || COLOR_PRIMARY);

        doc.fillColor(COLOR_MUTED)
           .fontSize(7)
           .font('Helvetica-Bold')
           .text(box.label.toUpperCase(), x + 8, startY + 6, { width: boxWidth - 12 });

        doc.fillColor(box.color || COLOR_TEXT)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(String(box.value), x + 8, startY + 18, { width: boxWidth - 12 });

        if (box.subtext) {
            doc.fillColor(COLOR_MUTED)
               .fontSize(6.5)
               .font('Helvetica')
               .text(box.subtext, x + 8, startY + 33, { width: boxWidth - 12 });
        }
    });

    return startY + boxHeight + 14;
}

/**
 * Dibuja las firmas institucionales
 */
function dibujarFirmas(doc, startY) {
    const margin = 40;
    const width = doc.page.width - (margin * 2);
    const colWidth = 220;

    if (startY + 70 > doc.page.height - 45) {
        doc.addPage();
        startY = 60;
    }

    const y = startY + 15;

    // Firma 1: Director
    const x1 = margin + 20;
    doc.rect(x1, y, colWidth, 0.8).fill(COLOR_TEXT);
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica-Bold')
       .text('DRA. CARMEN ROSA DELGADO', x1, y + 5, { align: 'center', width: colWidth });
    doc.fillColor(COLOR_MUTED).fontSize(7.5).font('Helvetica')
       .text('Directora de Programa de Licenciatura\nUniversidad de Investigación y Desarrollo (UDI)', x1, y + 17, { align: 'center', width: colWidth });

    // Firma 2: Coordinador de Prácticas
    const x2 = doc.page.width - margin - colWidth - 20;
    doc.rect(x2, y, colWidth, 0.8).fill(COLOR_TEXT);
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica-Bold')
       .text('COORDINACIÓN DE PRÁCTICAS ACADÉMICAS', x2, y + 5, { align: 'center', width: colWidth });
    doc.fillColor(COLOR_MUTED).fontSize(7.5).font('Helvetica')
       .text('Comité de Prácticas Pedagógicas\nFacultad de Ciencias Sociales y Humanas - UDI', x2, y + 17, { align: 'center', width: colWidth });

    return y + 55;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GENERADOR DE INFORME CONSOLIDADO DE PRÁCTICA PEDAGÓGICA (POR PRÁCTICA)
// ─────────────────────────────────────────────────────────────────────────────
function generatePracticaReportPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const practica = data.practica || {};
            const metricas = data.metricas || {};
            const participantes = data.participantes || [];

            agregarEncabezadoInstitucional(
                doc,
                `INFORME CONSOLIDADO DE PRÁCTICA: ${practica.nombre || 'PRÁCTICA PEDAGÓGICA'}`,
                `Fecha de emisión: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} · Semestre ${practica.semestre || '1'}`
            );

            // Ficha técnica
            let curY = doc.y;
            const margin = 40;
            const contentWidth = doc.page.width - (margin * 2);

            doc.rect(margin, curY, contentWidth, 42).fill(COLOR_BG_LIGHT);
            doc.rect(margin, curY, contentWidth, 42).strokeColor(COLOR_BORDER).lineWidth(0.8).stroke();

            doc.fillColor(COLOR_TEXT).fontSize(8);
            doc.font('Helvetica-Bold').text('Modalidad Curricular:', margin + 10, curY + 6);
            doc.font('Helvetica').text(practica.tipo || 'OBSERVACION', margin + 115, curY + 6);

            doc.font('Helvetica-Bold').text('Horas Reglamentarias:', margin + 270, curY + 6);
            doc.font('Helvetica').text(`${practica.horas || practica.horas_requeridas || 64} horas`, margin + 380, curY + 6);

            doc.font('Helvetica-Bold').text('Tutor Responsable:', margin + 10, curY + 18);
            doc.font('Helvetica').text(practica.tutor || 'Sin tutor asignado', margin + 115, curY + 18);

            doc.font('Helvetica-Bold').text('Estado de Oferta:', margin + 270, curY + 18);
            doc.font('Helvetica-Bold').fillColor(practica.estado === 'ABIERTA' ? COLOR_SUCCESS : COLOR_MUTED)
               .text(practica.estado || 'ABIERTA', margin + 380, curY + 18);

            doc.fillColor(COLOR_TEXT);
            doc.font('Helvetica-Bold').text('Población Semestre:', margin + 10, curY + 30);
            doc.font('Helvetica').text(`${metricas.totalMatriculados || participantes.length} estudiantes matriculados`, margin + 115, curY + 30);

            doc.font('Helvetica-Bold').text('Convenios Vinculados:', margin + 270, curY + 30);
            doc.font('Helvetica').text(`${metricas.institucionesVinculadas || 1} sedes activas`, margin + 380, curY + 30);

            curY += 52;

            // Cajas de KPIs
            const kpis = [
                { label: 'Inscritos en Práctica', value: participantes.length, color: COLOR_PRIMARY, subtext: 'Estudiantes asignados' },
                { label: 'Horas Validadas', value: `${metricas.totalHoras || 0} h`, color: COLOR_SECONDARY, subtext: 'Acumulado en bitácoras' },
                { label: 'Avance Promedio', value: `${metricas.promedioAvance || 0}%`, color: COLOR_SUCCESS, subtext: 'Cumplimiento global' },
                { label: 'Bitácoras Auditadas', value: metricas.totalBitacoras || 0, color: COLOR_ACCENT, subtext: `${metricas.bitacorasPendientes || 0} pendientes` }
            ];
            curY = dibujarKpiBoxes(doc, kpis, curY);

            // Título de la tabla
            doc.fillColor(COLOR_PRIMARY).fontSize(9.5).font('Helvetica-Bold')
               .text('AUDITORÍA DE PRACTICANTES INSCRITOS Y SEGUIMIENTO ACADÉMICO', margin, curY);
            curY += 14;

            // Tabla de Practicantes
            const colWidths = [140, 115, 65, 55, 65, 92]; // Total: 532
            const headers = ['Estudiante', 'Institución Receptora', 'Horas / Req.', '% Avance', 'Bitácoras', 'Estado'];

            // Cabecera tabla
            doc.rect(margin, curY, contentWidth, 18).fill(COLOR_PRIMARY);
            doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
            let hX = margin;
            headers.forEach((h, i) => {
                doc.text(h, hX + 4, curY + 5, { width: colWidths[i] - 8, align: i >= 2 && i <= 4 ? 'center' : 'left' });
                hX += colWidths[i];
            });
            curY += 18;

            // Filas
            if (participantes.length === 0) {
                doc.rect(margin, curY, contentWidth, 22).fill(COLOR_BG_LIGHT);
                doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Oblique')
                   .text('No hay practicantes vinculados a esta práctica pedagógica aún.', margin + 10, curY + 7);
                curY += 26;
            } else {
                participantes.forEach((p, idx) => {
                    if (curY > doc.page.height - 75) {
                        doc.addPage();
                        agregarEncabezadoInstitucional(doc, `INFORME: ${practica.nombre || 'PRÁCTICA'} (Continuación)`);
                        curY = doc.y;

                        // Repetir cabecera
                        doc.rect(margin, curY, contentWidth, 18).fill(COLOR_PRIMARY);
                        doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
                        let rX = margin;
                        headers.forEach((h, i) => {
                            doc.text(h, rX + 4, curY + 5, { width: colWidths[i] - 8, align: i >= 2 && i <= 4 ? 'center' : 'left' });
                            rX += colWidths[i];
                        });
                        curY += 18;
                    }

                    const isEven = idx % 2 === 0;
                    doc.rect(margin, curY, contentWidth, 20).fill(isEven ? '#FFFFFF' : COLOR_BG_LIGHT);
                    doc.rect(margin, curY, contentWidth, 20).strokeColor('#E5E8E8').lineWidth(0.5).stroke();

                    const horasCumplidas = p.horasAcumuladas || p.horas || 0;
                    const horasReq = p.horasRequeridas || practica.horas || 64;
                    const pct = horasReq > 0 ? Math.min(100, Math.round((horasCumplidas / horasReq) * 100)) : 0;

                    let rowX = margin;
                    doc.fillColor(COLOR_TEXT).fontSize(7.5);

                    // 1. Estudiante
                    doc.font('Helvetica-Bold').text(p.estudiante || p.nombre || 'Estudiante', rowX + 4, curY + 6, { width: colWidths[0] - 8, lineBreak: false });
                    rowX += colWidths[0];

                    // 2. Institución
                    doc.font('Helvetica').text(p.institucion || 'Sin asignar', rowX + 4, curY + 6, { width: colWidths[1] - 8, lineBreak: false });
                    rowX += colWidths[1];

                    // 3. Horas
                    doc.font('Helvetica-Bold').text(`${horasCumplidas} / ${horasReq} h`, rowX + 4, curY + 6, { width: colWidths[2] - 8, align: 'center' });
                    rowX += colWidths[2];

                    // 4. % Avance
                    doc.font('Helvetica-Bold')
                       .fillColor(pct >= 100 ? COLOR_SUCCESS : (pct >= 50 ? COLOR_SECONDARY : COLOR_WARNING))
                       .text(`${pct}%`, rowX + 4, curY + 6, { width: colWidths[3] - 8, align: 'center' });
                    doc.fillColor(COLOR_TEXT);
                    rowX += colWidths[3];

                    // 5. Bitácoras
                    const bitTotal = p.totalBitacoras !== undefined ? p.totalBitacoras : '-';
                    const bitPend = p.bitacorasPendientes !== undefined ? ` (${p.bitacorasPendientes} pend)` : '';
                    doc.font('Helvetica').text(`${bitTotal}${bitPend}`, rowX + 4, curY + 6, { width: colWidths[4] - 8, align: 'center' });
                    rowX += colWidths[4];

                    // 6. Estado
                    const estadoTexto = pct >= 100 ? '100% CUMPLIDO' : (p.estado || 'EN CURSO');
                    doc.font('Helvetica-Bold')
                       .fillColor(pct >= 100 ? COLOR_SUCCESS : (p.estado === 'FINALIZADA' ? COLOR_PRIMARY : COLOR_SECONDARY))
                       .text(estadoTexto, rowX + 4, curY + 6, { width: colWidths[5] - 8 });

                    curY += 20;
                });
            }

            curY += 15;
            dibujarFirmas(doc, curY);
            agregarPiePagina(doc);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GENERADOR DE INFORME DE AUDITORÍA DE CUPOS E INSTITUCIONES
// ─────────────────────────────────────────────────────────────────────────────
function generateCuposReportPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const instituciones = data.instituciones || [];
            const resumen = data.resumen || {};

            agregarEncabezadoInstitucional(
                doc,
                'INFORME DE AUDITORÍA DE CONVENIOS Y CONTROL DE CUPOS INSTITUCIONALES',
                `Dirección de Programa de Licenciatura · Supervisión en Tiempo Real · Emisión: ${new Date().toLocaleDateString('es-CO')}`
            );

            let curY = doc.y;
            const margin = 40;
            const contentWidth = doc.page.width - (margin * 2);

            // Cajas de KPIs de auditoría de red
            const kpis = [
                { label: 'Instituciones Aliadas', value: instituciones.length, color: COLOR_PRIMARY, subtext: 'Red de convenios' },
                { label: 'Capacidad Total', value: `${resumen.cuposTotales || 0} cupos`, color: COLOR_SECONDARY, subtext: 'Ofertados por centros' },
                { label: 'Cupos Asignados', value: `${resumen.cuposOcupados || 0} ocupados`, color: COLOR_WARNING, subtext: `${resumen.tasaOcupacion || 0}% de ocupación` },
                { label: 'Cupos Disponibles', value: `${resumen.cuposLibres || 0} libres`, color: COLOR_SUCCESS, subtext: 'Plazas vacantes' }
            ];
            curY = dibujarKpiBoxes(doc, kpis, curY);

            // Tabla de Instituciones
            doc.fillColor(COLOR_PRIMARY).fontSize(9.5).font('Helvetica-Bold')
               .text('ESTADO DETALLADO DE CUPOS Y VIGENCIA JURÍDICA POR INSTITUCIÓN RECEPTORA', margin, curY);
            curY += 14;

            const colWidths = [150, 75, 75, 45, 45, 45, 97]; // Total: 532
            const headers = ['Institución', 'Convenio', 'Vencimiento', 'Ofert.', 'Ocup.', 'Libre', 'Capacidad / Alerta'];

            doc.rect(margin, curY, contentWidth, 18).fill(COLOR_PRIMARY);
            doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
            let hX = margin;
            headers.forEach((h, i) => {
                doc.text(h, hX + 4, curY + 5, { width: colWidths[i] - 8, align: i >= 3 && i <= 5 ? 'center' : 'left' });
                hX += colWidths[i];
            });
            curY += 18;

            instituciones.forEach((inst, idx) => {
                if (curY > doc.page.height - 75) {
                    doc.addPage();
                    agregarEncabezadoInstitucional(doc, 'AUDITORÍA DE CUPOS E INSTITUCIONES (Continuación)');
                    curY = doc.y;

                    doc.rect(margin, curY, contentWidth, 18).fill(COLOR_PRIMARY);
                    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
                    let rX = margin;
                    headers.forEach((h, i) => {
                        doc.text(h, rX + 4, curY + 5, { width: colWidths[i] - 8, align: i >= 3 && i <= 5 ? 'center' : 'left' });
                        rX += colWidths[i];
                    });
                    curY += 18;
                }

                const isEven = idx % 2 === 0;
                doc.rect(margin, curY, contentWidth, 22).fill(isEven ? '#FFFFFF' : COLOR_BG_LIGHT);
                doc.rect(margin, curY, contentWidth, 22).strokeColor('#E5E8E8').lineWidth(0.5).stroke();

                const cuposTot = inst.cupos || inst.cupos_disponibles || 0;
                const cuposOcup = inst.estudiantesAsignados || inst.cupos_ocupados || 0;
                const cuposLib = Math.max(0, cuposTot - cuposOcup);
                const pctOcup = cuposTot > 0 ? Math.round((cuposOcup / cuposTot) * 100) : 0;

                let rowX = margin;
                doc.fillColor(COLOR_TEXT).fontSize(7.5);

                // 1. Institución
                doc.font('Helvetica-Bold').text(inst.nombre || 'Institución', rowX + 4, curY + 5, { width: colWidths[0] - 8, lineBreak: false });
                if (inst.direccion) {
                    doc.font('Helvetica').fillColor(COLOR_MUTED).fontSize(6.5)
                       .text(inst.direccion, rowX + 4, curY + 13, { width: colWidths[0] - 8, lineBreak: false });
                }
                rowX += colWidths[0];

                // 2. Convenio
                doc.fillColor(COLOR_TEXT).fontSize(7.5);
                const convActivo = inst.convenioActivo === 'S' || inst.convenio_activo === 'S';
                doc.font('Helvetica-Bold').fillColor(convActivo ? COLOR_SUCCESS : COLOR_DANGER)
                   .text(convActivo ? 'VIGENTE (S)' : 'INACTIVO (N)', rowX + 4, curY + 7);
                doc.fillColor(COLOR_TEXT);
                rowX += colWidths[1];

                // 3. Vencimiento
                doc.font('Helvetica').text(inst.vencimiento || inst.fecha_venc_convenio || 'Indefinido', rowX + 4, curY + 7);
                rowX += colWidths[2];

                // 4. Ofertados
                doc.font('Helvetica').text(String(cuposTot), rowX + 4, curY + 7, { width: colWidths[3] - 8, align: 'center' });
                rowX += colWidths[3];

                // 5. Ocupados
                doc.font('Helvetica-Bold').fillColor(cuposOcup >= cuposTot && cuposTot > 0 ? COLOR_DANGER : COLOR_TEXT)
                   .text(String(cuposOcup), rowX + 4, curY + 7, { width: colWidths[4] - 8, align: 'center' });
                doc.fillColor(COLOR_TEXT);
                rowX += colWidths[4];

                // 6. Libres
                doc.font('Helvetica-Bold').fillColor(cuposLib > 0 ? COLOR_SUCCESS : COLOR_MUTED)
                   .text(String(cuposLib), rowX + 4, curY + 7, { width: colWidths[5] - 8, align: 'center' });
                doc.fillColor(COLOR_TEXT);
                rowX += colWidths[5];

                // 7. Alerta
                let alertaText = `${pctOcup}% Ocupado`;
                let alertaColor = COLOR_SUCCESS;
                if (pctOcup >= 100) {
                    alertaText = '🔴 SATURADA (100%)';
                    alertaColor = COLOR_DANGER;
                } else if (pctOcup >= 70) {
                    alertaText = `🟠 ALTO (${pctOcup}%)`;
                    alertaColor = COLOR_WARNING;
                } else {
                    alertaText = `🟢 DISPONIBLE (${pctOcup}%)`;
                }

                doc.font('Helvetica-Bold').fillColor(alertaColor)
                   .text(alertaText, rowX + 4, curY + 7, { width: colWidths[6] - 8 });

                curY += 22;
            });

            curY += 15;
            dibujarFirmas(doc, curY);
            agregarPiePagina(doc);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GENERADOR DE ACTA FORMAL DE CIERRE (CU-14 / CU-15)
// ─────────────────────────────────────────────────────────────────────────────
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

            const horasCumplidas = Number(data.horas_cumplidas !== undefined ? data.horas_cumplidas : (data.horasCumplidas !== undefined ? data.horasCumplidas : 64));
            const totalHoras = Number(data.total_horas_requeridas !== undefined ? data.total_horas_requeridas : (data.totalHorasRequeridas !== undefined ? data.totalHorasRequeridas : 64));
            const porcentaje = totalHoras > 0 ? Math.min(100, Math.round((horasCumplidas / totalHoras) * 100)) : 100;
            const notaFinal = data.nota_final !== undefined ? Number(data.nota_final).toFixed(1) : (data.notaFinal !== undefined ? Number(data.notaFinal).toFixed(1) : '5.0');
            const fechaCierre = data.fecha_cierre || data.fechaCierre || new Date().toISOString().split('T')[0];
            const avalInSitu = Boolean(data.aval_in_situ !== undefined ? data.aval_in_situ : true);
            const avalTutor = Boolean(data.aval_tutor !== undefined ? data.aval_tutor : true);

            // Encabezado
            doc.rect(45, 40, 522, 54).fill(COLOR_PRIMARY);

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

            // Título
            doc.rect(45, doc.y, 522, 28).fill('#E8F8F5');
            doc.fillColor('#117864')
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('ACTA FORMAL DE CIERRE Y CULMINACIÓN DE PRÁCTICA FORMATIVA (CU-14 / CU-15)', 45, doc.y + 8, { align: 'center', width: 522 });

            doc.y = 140;

            // Certificación y Declaración Legal
            const decY = doc.y;
            doc.rect(45, decY, 522, 48).fill(COLOR_BG_LIGHT);
            doc.rect(45, decY, 522, 48).strokeColor(COLOR_BORDER).lineWidth(0.8).stroke();

            doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica')
               .text(
                   'Por medio de la presente, la Coordinación de Prácticas de la Licenciatura en Educación Infantil y el Comité Evaluador ' +
                   'certifican que el/la estudiante ha cumplido a cabalidad con las actividades pedagógicas, horas reglamentarias y ' +
                   'criterios de evaluación estipulados para la modalidad de práctica académica durante el período correspondiente.',
                   55, decY + 8, { width: 502, align: 'justify', lineGap: 2 }
               );

            doc.y = decY + 58;

            // Ficha de Información
            const infoY = doc.y;
            doc.rect(45, infoY, 522, 85).strokeColor(COLOR_BORDER).lineWidth(1).stroke();
            doc.rect(45, infoY, 522, 18).fill(COLOR_SECONDARY);
            doc.fillColor('#FFFFFF')
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('DATOS DE LA PRÁCTICA Y RESULTADOS FINALES', 55, infoY + 5);

            const col1 = 55;
            const col2 = 310;
            let currentY = infoY + 24;

            doc.fillColor(COLOR_TEXT).fontSize(8.5);
            doc.font('Helvetica-Bold').text('Estudiante:', col1, currentY);
            doc.font('Helvetica').text(estudiante.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Fecha de Cierre:', col2, currentY);
            doc.font('Helvetica').text(String(fechaCierre), col2 + 85, currentY);

            currentY += 14;
            doc.font('Helvetica-Bold').text('Código / Doc:', col1, currentY);
            doc.font('Helvetica').text(estudiante.codigo || estudiante.documento || estudiante.email || 'No registrado', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Horas Realizadas:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor(porcentaje >= 100 ? COLOR_SUCCESS : COLOR_DANGER)
               .text(`${horasCumplidas} / ${totalHoras} hrs (${porcentaje}%)`, col2 + 85, currentY);

            currentY += 14;
            doc.fillColor(COLOR_TEXT);
            doc.font('Helvetica-Bold').text('Tutor Académico:', col1, currentY);
            doc.font('Helvetica').text(tutor.nombre || 'N/A', col1 + 75, currentY);
            doc.font('Helvetica-Bold').text('Calificación Final:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor(COLOR_PRIMARY).text(`${notaFinal} / 5.0 (APROBADO)`, col2 + 85, currentY);

            currentY += 14;
            doc.fillColor(COLOR_TEXT);
            doc.font('Helvetica-Bold').text('Institución Receptora:', col1, currentY);
            doc.font('Helvetica').text(institucion.nombre || 'N/A', col1 + 105, currentY);
            doc.font('Helvetica-Bold').text('Estado:', col2, currentY);
            doc.font('Helvetica-Bold').fillColor(COLOR_SUCCESS).text('CULMINADA Y APROBADA', col2 + 85, currentY);

            doc.y = infoY + 95;

            // Avales Tripartitos
            const avalY = doc.y;
            doc.rect(45, avalY, 522, 18).fill(COLOR_SECONDARY);
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
               .text('VERIFICACIÓN DE AVALES DE CONFORMIDAD REGLAMENTARIOS', 55, avalY + 5);

            doc.rect(45, avalY + 18, 522, 45).strokeColor(COLOR_BORDER).lineWidth(1).stroke();

            doc.fillColor(COLOR_TEXT).fontSize(8.5);
            doc.font('Helvetica-Bold').text('Aval Asesor In Situ (Institución):', 55, avalY + 25);
            doc.font('Helvetica-Bold').fillColor(avalInSitu ? COLOR_SUCCESS : COLOR_DANGER)
               .text(avalInSitu ? '✔ CERTIFICADO Y APROBADO EN SEDE' : 'PENDIENTE', 230, avalY + 25);

            doc.fillColor(COLOR_TEXT);
            doc.font('Helvetica-Bold').text('Aval Tutor Académico (UDI):', 55, avalY + 42);
            doc.font('Helvetica-Bold').fillColor(avalTutor ? COLOR_SUCCESS : COLOR_DANGER)
               .text(avalTutor ? '✔ CONVALIDADO Y AVALADO POR EL DOCENTE' : 'PENDIENTE', 230, avalY + 42);

            doc.y = avalY + 72;

            // Criterios Evaluativos
            const tableY = doc.y;
            doc.rect(45, tableY, 522, 20).fill(COLOR_PRIMARY);
            doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
            doc.text('COMPETENCIA PEDAGÓGICA Y DESEMPEÑO', 55, tableY + 6, { width: 330 });
            doc.text('ESTADO / CALIFICACIÓN', 390, tableY + 6, { width: 165, align: 'center' });

            const criterios = [
                { nombre: `Cumplimiento de horas formativas en centro de práctica (100%)`, estado: `CUMPLIDO (${horasCumplidas}h)` },
                { nombre: 'Diligenciamiento continuo de bitácoras y tres momentos pedagógicos', estado: 'CUMPLIDO Y REVISADO' },
                { nombre: 'Visitas de acompañamiento y seguimiento in situ aprobadas', estado: 'APROBADO' },
                { nombre: 'Evaluación de competencias didácticas y relacionales', estado: `NOTA FINAL: ${notaFinal}` }
            ];

            let rowY = tableY + 20;
            criterios.forEach((c, idx) => {
                const isEven = idx % 2 === 0;
                doc.rect(45, rowY, 522, 18).fill(isEven ? '#FFFFFF' : COLOR_BG_LIGHT);
                doc.rect(45, rowY, 522, 18).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

                doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica').text(c.nombre, 55, rowY + 5, { width: 330 });
                doc.font('Helvetica-Bold').fillColor(COLOR_SUCCESS).text(c.estado, 390, rowY + 5, { width: 165, align: 'center' });
                rowY += 18;
            });

            doc.y = rowY + 25;
            dibujarFirmas(doc, doc.y);

            // Pie de página
            doc.fillColor(COLOR_MUTED).fontSize(7.5).font('Helvetica')
               .text(`Código de Verificación Electrónica: UDI-ACTA-${Date.now().toString(36).toUpperCase()} · Validez Académica Nacional`, 45, doc.page.height - 35, { align: 'center', width: 522 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GENERADOR DE INFORME DE VISITA (CU-13)
// ─────────────────────────────────────────────────────────────────────────────
function generateVisitReportPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 40, bottom: 40, left: 45, right: 45 }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const estudiante = typeof data.estudiante === 'object' && data.estudiante !== null
                ? data.estudiante : { nombre: data.estudiante || 'No especificado' };
            const tutor = typeof data.tutor === 'object' && data.tutor !== null
                ? data.tutor : { nombre: data.tutor || 'No especificado' };
            const institucion = typeof data.institucion === 'object' && data.institucion !== null
                ? data.institucion : { nombre: data.institucion || 'No especificada' };
            const evaluacion = data.evaluacion || {};
            const fechaVisita = data.fecha_visita || new Date().toISOString().split('T')[0];
            const nota = evaluacion.nota !== undefined ? Number(evaluacion.nota).toFixed(1) : (data.nota ? Number(data.nota).toFixed(1) : '5.0');
            const rubricas = Array.isArray(evaluacion.rubricas) && evaluacion.rubricas.length > 0
                ? evaluacion.rubricas
                : [
                    { criterio: 'Puntualidad, presentación y actitud profesional', calificacion: '5.0', observacion: 'Excelente compromiso y puntualidad en la jornada.' },
                    { criterio: 'Planeación didáctica y dominio disciplinar', calificacion: '4.8', observacion: 'Propuesta didáctica articulada a las necesidades del aula.' },
                    { criterio: 'Interacción pedagógica y gestión de aula con los niños', calificacion: '5.0', observacion: 'Clima de confianza, afecto y respeto con los estudiantes.' },
                    { criterio: 'Diligenciamiento de bitácoras y evidencias', calificacion: '4.7', observacion: 'Formatos al día con las horas y reflexiones consignadas.' }
                ];

            agregarEncabezadoInstitucional(
                doc,
                `INFORME DE VISITA DE SUPERVISIÓN Y ACOMPAÑAMIENTO (CU-13)`,
                `Visita Presencial de Tutoría Docente · Fecha: ${fechaVisita}`
            );

            let curY = doc.y;
            const margin = 45;
            const contentWidth = doc.page.width - (margin * 2);

            // Ficha
            doc.rect(margin, curY, contentWidth, 54).fill(COLOR_BG_LIGHT);
            doc.rect(margin, curY, contentWidth, 54).strokeColor(COLOR_BORDER).lineWidth(0.8).stroke();

            doc.fillColor(COLOR_TEXT).fontSize(8.5);
            doc.font('Helvetica-Bold').text('Estudiante Practicante:', margin + 10, curY + 8);
            doc.font('Helvetica').text(estudiante.nombre || 'N/A', margin + 120, curY + 8);

            doc.font('Helvetica-Bold').text('Tutor Universitario:', margin + 270, curY + 8);
            doc.font('Helvetica').text(tutor.nombre || 'N/A', margin + 375, curY + 8);

            doc.font('Helvetica-Bold').text('Institución Educativa:', margin + 10, curY + 23);
            doc.font('Helvetica').text(institucion.nombre || 'N/A', margin + 120, curY + 23);

            doc.font('Helvetica-Bold').text('Calificación Visita:', margin + 270, curY + 23);
            doc.font('Helvetica-Bold').fillColor(COLOR_SUCCESS).text(`${nota} / 5.0 (APROBADO)`, margin + 375, curY + 23);

            doc.fillColor(COLOR_TEXT);
            doc.font('Helvetica-Bold').text('Observación General:', margin + 10, curY + 38);
            doc.font('Helvetica').text(evaluacion.observaciones || data.observaciones || 'Acompañamiento presencial completado satisfactoriamente.', margin + 120, curY + 38, { width: 380, lineBreak: false });

            curY += 68;

            // Tabla Rúbricas
            doc.fillColor(COLOR_PRIMARY).fontSize(9.5).font('Helvetica-Bold')
               .text('RÚBRICA DE VALORACIÓN PEDAGÓGICA IN SITU', margin, curY);
            curY += 14;

            doc.rect(margin, curY, contentWidth, 18).fill(COLOR_PRIMARY);
            doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
            doc.text('CRITERIO DE EVALUACIÓN', margin + 8, curY + 5, { width: 220 });
            doc.text('NOTA', margin + 235, curY + 5, { width: 45, align: 'center' });
            doc.text('CONCEPTO CUALITATIVO', margin + 285, curY + 5, { width: 225 });
            curY += 18;

            rubricas.forEach((r, idx) => {
                const isEven = idx % 2 === 0;
                doc.rect(margin, curY, contentWidth, 24).fill(isEven ? '#FFFFFF' : COLOR_BG_LIGHT);
                doc.rect(margin, curY, contentWidth, 24).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

                doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold').text(r.criterio, margin + 8, curY + 7, { width: 220 });
                doc.font('Helvetica-Bold').fillColor(COLOR_SUCCESS).text(String(r.calificacion), margin + 235, curY + 7, { width: 45, align: 'center' });
                doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(7.5).text(r.observacion, margin + 285, curY + 7, { width: 225 });
                curY += 24;
            });

            curY += 25;
            dibujarFirmas(doc, curY);

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generatePracticaReportPdf,
    generateCuposReportPdf,
    generateClosureActPdf,
    generateVisitReportPdf,
};
