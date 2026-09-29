/**
 * SIGPA — Rutas de Estudiante
 * /api/estudiante/*
 * Seguridad: Requiere Token JWT activo
 */
'use strict';

const express = require('express');
const router = express.Router();
const estudianteController = require('../controllers/estudiante.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Todas las rutas de estudiante requieren token JWT
router.use(verificarToken);

// Consulta de asignación, progreso, portafolio y timeline
router.get('/asignacion', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getAsignacion);
router.get('/progreso', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getProgreso);
router.get('/bitacoras', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getBitacoras);
router.get('/timeline', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getTimeline);
router.get('/evidencias', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getEvidencias);
router.get('/evaluaciones', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getEvaluaciones);
router.get('/preguntas_guia', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getPreguntasGuia);
router.get('/preguntas-guia/:id_practica/:visita', verificarRol(['ESTUDIANTE', 'DIRECTOR', 'TUTOR', 'COORDINADOR', 'ASESOR']), estudianteController.getPreguntasGuia);

// Registro de bitácoras por momentos (Estudiantes)
router.post('/bitacora', verificarRol(['ESTUDIANTE', 'DIRECTOR']), estudianteController.registrarBitacora);
router.post('/registrar_bitacora', verificarRol(['ESTUDIANTE', 'DIRECTOR']), estudianteController.registrarBitacora);

module.exports = router;
