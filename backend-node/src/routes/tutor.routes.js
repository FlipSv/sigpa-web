/**
 * SIGPA — Rutas de Tutor y Coordinador
 * /api/tutor/* y /api/coordinador/*
 * Seguridad: Requiere Token JWT activo y Rol TUTOR, COORDINADOR o DIRECTOR
 */
'use strict';

const express = require('express');
const router = express.Router();
const tutorController = require('../controllers/tutor.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Proteger todas las rutas de tutor y coordinador
router.use(verificarToken, verificarRol(['TUTOR', 'COORDINADOR', 'DIRECTOR']));

router.get('/asignaciones', tutorController.getAsignaciones);
router.get('/estudiantes', tutorController.getAsignaciones);
router.get('/bitacoras', tutorController.getBitacoras);
router.get('/bitacoras_pendientes', tutorController.getBitacoras);

router.post('/calificar', tutorController.calificarBitacora);
router.post('/aprobar_asignacion', tutorController.aprobarAsignacion);

module.exports = router;
