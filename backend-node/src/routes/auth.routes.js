/**
 * SIGPA — Rutas de Autenticación
 * /api/login, /api/perfil, /api/perfil/cambiar-contrasena
 */
'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { loginRateLimiter } = require('../middlewares/rateLimiter');

// Login con protección estricta contra fuerza bruta
router.post('/login', loginRateLimiter, authController.login);

// Consulta de perfil del usuario autenticado
router.get('/perfil', verificarToken, authController.perfil);

// Cambio de contraseña seguro para el usuario autenticado
router.post('/perfil/cambiar-contrasena', verificarToken, authController.cambiarContrasena);
router.post('/cambiar-contrasena', verificarToken, authController.cambiarContrasena);

module.exports = router;
