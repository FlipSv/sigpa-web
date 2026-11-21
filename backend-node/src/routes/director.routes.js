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
router.get('/usuarios', directorController.getUsuarios);
router.get('/asignaciones', directorController.getAsignaciones);

router.post('/cambiar_estado', directorController.cambiarEstado);
router.post('/nueva_practica', directorController.nuevaPractica);
router.post('/nueva_institucion', directorController.nuevaInstitucion);
router.post('/asignar', directorController.asignarEstudiante);

// Gestión de cuentas de usuario por el Director
router.post('/nuevo_usuario', directorController.nuevoUsuario);
router.post('/cambiar_estado_usuario', directorController.cambiarEstadoUsuario);

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

module.exports = router;
