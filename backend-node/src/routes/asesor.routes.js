/**
 * SIGPA — Rutas de Asesor In Situ
 * /api/asesor/*
 */
'use strict';

const express = require('express');
const router = express.Router();
const asesorController = require('../controllers/asesor.controller');

router.get('/estudiantes', asesorController.getEstudiantes);
router.get('/asignaciones', asesorController.getEstudiantes);
router.get('/bitacoras', asesorController.getBitacoras);

router.post('/evaluar', asesorController.evaluarInSitu);

module.exports = router;
