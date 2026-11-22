/**
 * SIGPA — Document & Reporting Microservice
 * Rutas de la API de Reportes (/api/v1/reports)
 */
'use strict';

const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');

// Health Check
router.get('/health', reportsController.getHealth);

// Documentación de la API
router.get('/docs', reportsController.getDocs);

// Listar reportes almacenados
router.get('/', reportsController.listReports);

// Generación de informes y actas PDF
router.post('/visita-pdf', reportsController.generateVisitaPdf);
router.post('/acta-cierre-pdf', reportsController.generateActaCierrePdf);

// Recuperación de reporte por UUID
router.get('/:id', reportsController.getReportById);

module.exports = router;
