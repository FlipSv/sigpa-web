/**
 * SIGPA — API Gateway
 * Enrutamiento Principal de Microservicios
 */
'use strict';

const express = require('express');
const router = express.Router();
const config = require('../config');
const { createReverseProxy } = require('../proxy/reverseProxy');

// Proxy hacia el Microservicio de Reportes (:5001)
// NOTA CRÍTICA: Debe registrarse antes de /api para tener mayor precedencia
const reportingProxy = createReverseProxy(config.services.reporting.url);
router.use('/api/v1/reports', reportingProxy);

// Proxy hacia el Backend Central / Core API (:5000)
const coreApiProxy = createReverseProxy(config.services.coreApi.url);
router.use('/api', coreApiProxy);

module.exports = router;
