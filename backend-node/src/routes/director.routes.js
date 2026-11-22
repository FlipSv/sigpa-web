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
router.get('/asignaciones', directorController.getAsignaciones);

router.post('/cambiar_estado', directorController.cambiarEstado);
router.post('/nueva_practica', directorController.nuevaPractica);
router.post('/nueva_institucion', directorController.nuevaInstitucion);
router.post('/asignar', directorController.asignarEstudiante);

router.post('/aprobar_asignacion', directorController.aprobarAsignacion);

module.exports = router;
