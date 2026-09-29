/**
 * SIGPA — Rutas de Asesor In Situ
 * /api/asesor/*
 * Seguridad: Requiere Token JWT activo y Rol ASESOR o DIRECTOR
 */
'use strict';

const express = require('express');
const router = express.Router();
const asesorController = require('../controllers/asesor.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Proteger todas las rutas de Asesor In Situ
router.use(verificarToken, verificarRol(['ASESOR', 'DIRECTOR']));

router.get('/estudiantes', asesorController.getEstudiantes);
router.get('/asignaciones', asesorController.getEstudiantes);
router.get('/bitacoras', asesorController.getBitacoras);

router.post('/evaluar', asesorController.evaluarInSitu);

module.exports = router;
