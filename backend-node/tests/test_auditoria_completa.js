/**
 * Test E2E de Auditoría en Tiempo Real y Generación de Reportes PDF
 * SIGPA — Director de Programa
 */
'use strict';

const http = require('http');

function req(options, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        let json = null;
        if (ct.includes('application/json')) {
          try { json = JSON.parse(buf.toString('utf8')); } catch(e) {}
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json, buffer: buf });
      });
    });
    request.on('error', reject);
    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      request.write(data);
    }
    request.end();
  });
}

(async () => {
  console.log('====================================================');
  console.log('  SIGPA — Batería de Pruebas: Auditoría y Reportes  ');
  console.log('====================================================');
  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✔ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${desc}`);
    }
  }

  try {
    // 1. Login Director
    const loginRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'director@sigpa.edu', contrasena: '1234' });

    assert('Autenticación del Director (200 OK)', loginRes.status === 200 && loginRes.body && loginRes.body.token);
    const token = loginRes.body ? loginRes.body.token : null;

    // 2. Consulta Compleja de Agregación: Auditoría de Cupos e Instituciones
    const cuposRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/director/auditoria/cupos-instituciones', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert('Endpoint Auditoría de Cupos responde 200 OK', cuposRes.status === 200);
    assert('Estructura de resumen global de la red presente', cuposRes.body && cuposRes.body.data && typeof cuposRes.body.data.resumen.totalInstituciones === 'number');
    assert('Cálculo de cupos totales y libres consistente', cuposRes.body && cuposRes.body.data.resumen.cuposLibres >= 0);
    assert('Lista de instituciones con agregación de ocupación y practicantes', Array.isArray(cuposRes.body.data.instituciones) && cuposRes.body.data.instituciones.length > 0);

    // 3. Consulta Compleja de Agregación: Auditoría General de Practicantes
    const practRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/director/auditoria/practicantes', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert('Endpoint Auditoría de Practicantes responde 200 OK', practRes.status === 200);
    assert('Resumen global de practicantes y horas presente', practRes.body && practRes.body.data && typeof practRes.body.data.resumen.totalPracticantes === 'number');
    assert('Desglose pormenorizado de estudiantes con bitácoras y horas', Array.isArray(practRes.body.data.practicantes));

    // 4. Consulta Compleja de Agregación: Consolidado por Prácticas Curriculares
    const consolRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/director/auditoria/consolidado-practicas', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert('Endpoint Consolidado de Prácticas responde 200 OK', consolRes.status === 200);
    assert('Agrupación curricular por práctica y semestre con tutores', Array.isArray(consolRes.body.data) && consolRes.body.data.length > 0);

    // 5. Generación y Descarga de Informe Oficial de Práctica en PDF
    const pdfPracRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/director/reportes/practica/3/pdf', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert('Generación PDF Informe de Práctica (200 OK)', pdfPracRes.status === 200);
    assert('Cabecera Content-Type es application/pdf', (pdfPracRes.headers['content-type'] || '').includes('application/pdf'));
    assert('Firma binaria válida (%PDF-) y tamaño > 1KB', pdfPracRes.buffer && pdfPracRes.buffer.toString('utf8', 0, 4) === '%PDF' && pdfPracRes.buffer.length > 1024);

    // 6. Generación y Descarga de Auditoría de Cupos e Instituciones en PDF
    const pdfCuposRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/director/reportes/cupos/pdf', method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert('Generación PDF Auditoría de Cupos (200 OK)', pdfCuposRes.status === 200);
    assert('Cabecera Content-Type es application/pdf para cupos', (pdfCuposRes.headers['content-type'] || '').includes('application/pdf'));
    assert('Firma binaria válida (%PDF-) en auditoría de cupos', pdfCuposRes.buffer && pdfCuposRes.buffer.toString('utf8', 0, 4) === '%PDF' && pdfCuposRes.buffer.length > 1024);

    // 7. Ruta de Compatibilidad: Generación de Acta de Cierre en PDF (CU-14 / CU-15)
    const pdfActaRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/v1/reports/acta-cierre-pdf', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, {
      id_asignacion: 1,
      estudiante: 'Santiago Acevedo',
      tutor: 'Prof. Carlos Andrés Mendoza',
      institucion: 'LA ISLA',
      horas_cumplidas: 64,
      total_horas_requeridas: 64,
      nota_final: 4.9
    });
    assert('Ruta /api/v1/reports/acta-cierre-pdf responde 200 OK', pdfActaRes.status === 200);
    assert('Acta de Cierre emitida en binario PDF (%PDF-)', pdfActaRes.buffer && pdfActaRes.buffer.toString('utf8', 0, 4) === '%PDF');

    // 8. Ruta de Compatibilidad: Generación de Informe de Visita en PDF (CU-13)
    const pdfVisitaRes = await req({
      hostname: 'localhost', port: 8081, path: '/api/v1/reports/visita-pdf', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, {
      visita: 1,
      estudiante: 'Santiago Acevedo',
      tutor: 'Prof. Carlos Andrés Mendoza',
      institucion: 'Colegio Piloto UDI'
    });
    assert('Ruta /api/v1/reports/visita-pdf responde 200 OK', pdfVisitaRes.status === 200);
    assert('Informe de Visita emitido en binario PDF (%PDF-)', pdfVisitaRes.buffer && pdfVisitaRes.buffer.toString('utf8', 0, 4) === '%PDF');

  } catch(err) {
    console.error('Error durante la ejecución del test:', err);
  }

  console.log('====================================================');
  console.log(`  RESULTADOS: ${passed}/${total} pruebas superadas (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
})();
