/**
 * SIGPA — Rutas de Tutor y Coordinador
 * /api/tutor/* y /api/coordinador/*
 */
'use strict';

const express = require('express');
const router = express.Router();
const tutorController = require('../controllers/tutor.controller');

router.get('/asignaciones', tutorController.getAsignaciones);
router.get('/estudiantes', tutorController.getAsignaciones);
router.get('/bitacoras', tutorController.getBitacoras);
router.get('/bitacoras_pendientes', tutorController.getBitacoras);

router.post('/calificar', tutorController.calificarBitacora);
router.post('/aprobar_asignacion', tutorController.aprobarAsignacion);

module.exports = router;
