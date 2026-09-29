/**
 * SIGPA — Rutas de Director
 * /api/director/*
 */
'use strict';

const express = require('express');
const router = express.Router();
const directorController = require('../controllers/director.controller');

router.get('/kpis', directorController.getKpis);
router.get('/estado', directorController.getPracticas);
router.get('/practicas', directorController.getPracticas);
router.get('/instituciones', directorController.getInstituciones);
router.get('/usuarios', directorController.getUsuarios);
router.get('/asignaciones', directorController.getAsignaciones);

router.post('/cambiar_estado', directorController.cambiarEstado);
router.post('/nueva_practica', directorController.nuevaPractica);
router.post('/nueva_institucion', directorController.nuevaInstitucion);
router.post('/asignar', directorController.asignarEstudiante);

// Gestión de cuentas de usuario por el Director
router.post('/nuevo_usuario', directorController.nuevoUsuario);
router.post('/cambiar_estado_usuario', directorController.cambiarEstadoUsuario);

module.exports = router;
