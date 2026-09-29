/**
 * SIGPA — Rutas de Estudiante
 * /api/estudiante/*
 */
'use strict';

const express = require('express');
const router = express.Router();
const estudianteController = require('../controllers/estudiante.controller');

router.get('/asignacion', estudianteController.getAsignacion);
router.get('/progreso', estudianteController.getProgreso);
router.get('/bitacoras', estudianteController.getBitacoras);
router.get('/timeline', estudianteController.getTimeline);
router.get('/evidencias', estudianteController.getEvidencias);
router.get('/evaluaciones', estudianteController.getEvaluaciones);
router.get('/preguntas_guia', estudianteController.getPreguntasGuia);
router.get('/preguntas-guia/:id_practica/:visita', estudianteController.getPreguntasGuia);

router.post('/bitacora', estudianteController.registrarBitacora);
router.post('/registrar_bitacora', estudianteController.registrarBitacora);

module.exports = router;

