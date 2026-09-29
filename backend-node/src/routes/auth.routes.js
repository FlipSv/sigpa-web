/**
 * SIGPA — Rutas de Autenticación
 * /api/login
 */
'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/login', authController.login);

module.exports = router;
