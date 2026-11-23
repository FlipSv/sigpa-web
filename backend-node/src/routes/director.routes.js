/**
 * SIGPA — Rutas de Director
 * /api/director/*
 * Seguridad: Requiere Token JWT activo y Rol DIRECTOR
 */
'use strict';

const express = require('express');
const router = express.Router();
const directorController = require('../controllers/director.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Middleware global para todas las rutas del módulo Director
router.use(verificarToken, verificarRol(['DIRECTOR']));

router.get('/kpis', directorController.getKpis);
router.get('/estado', directorController.getPracticas);
router.get('/practicas', directorController.getPracticas);
router.get('/instituciones', directorController.getInstituciones);
router.get('/estudiantes', directorController.getEstudiantes);
router.get('/tutores', directorController.getTutores);
router.get('/conteo-estudiantes', directorController.getConteoEstudiantesPorSemestre);
router.get('/asignaciones', directorController.getAsignaciones);

router.post('/cambiar_estado', directorController.cambiarEstado);
router.post('/nueva_practica', directorController.nuevaPractica);
router.post('/asignar_tutor_practica', directorController.asignarTutorPractica);
router.post('/eliminar_practica', directorController.eliminarPractica);
router.delete('/practica/:id', directorController.eliminarPractica);

router.post('/nueva_institucion', directorController.nuevaInstitucion);
router.post('/eliminar_institucion', directorController.eliminarInstitucion);
router.delete('/institucion/:id', directorController.eliminarInstitucion);
router.post('/asignar', directorController.asignarEstudiante);

router.post('/aprobar_asignacion', directorController.aprobarAsignacion);

// CU-10: Configuración y Consulta Curricular de Preguntas Guía
router.post('/preguntas-guia', directorController.guardarPreguntasGuia);
router.post('/preguntas_guia', directorController.guardarPreguntasGuia);
router.get('/preguntas-guia', directorController.getPreguntasGuiaDirector);
router.get('/preguntas_guia', directorController.getPreguntasGuiaDirector);
router.get('/preguntas-guia/:id_practica/:visita', directorController.getPreguntasGuiaDirector);

// CU-14 / CU-15: Cierre de Práctica y Emisión de Acta
router.post('/cerrar-practica', directorController.cerrarPractica);
router.post('/cerrar_practica', directorController.cerrarPractica);
router.post('/cerrar-asignacion', directorController.cerrarPractica);
router.post('/cerrar_asignacion', directorController.cerrarPractica);

// Auditoría Compleja en Tiempo Real e Informes Consolidados
router.get('/auditoria/cupos-instituciones', directorController.getAuditoriaCupos);
router.get('/auditoria/practicantes', directorController.getAuditoriaPracticantes);
router.get('/auditoria/consolidado-practicas', directorController.getConsolidadoPracticas);

// Generación y Descarga Directa de Reportes Oficiales en PDF
router.get('/reportes/practica/:id/pdf', directorController.descargarReportePracticaPdf);
router.get('/reportes/cupos/pdf', directorController.descargarAuditoriaCuposPdf);
router.get('/reportes/acta/:id/pdf', directorController.descargarActaCierreDirecta);
router.post('/reportes/acta-cierre-pdf', directorController.descargarActaCierreDirecta);
router.post('/reportes/visita-pdf', directorController.descargarReporteVisitaDirecto);

module.exports = router;
