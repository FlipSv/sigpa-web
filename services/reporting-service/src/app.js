/**
 * SIGPA — Document & Reporting Microservice
 * Configuración de la aplicación Express
 */
'use strict';

const express = require('express');
const cors = require('cors');
const reportsRoutes = require('./routes/reportsRoutes');

const app = express();

// Middlewares globales
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-user-id', 'x-user-role']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Montaje de rutas del microservicio
app.use('/api/v1/reports', reportsRoutes);

// Endpoint health check alternativo a nivel raíz
app.get('/health', (req, res) => {
    res.redirect('/api/v1/reports/health');
});

// Manejo de rutas no encontradas en el microservicio
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Ruta no encontrada en microservicio de reportes: ${req.method} ${req.originalUrl}`
    });
});

// Manejo centralizado de excepciones
app.use((err, req, res, next) => {
    console.error('[REPORTING-SERVICE] Error no controlado:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno en microservicio de reportes'
    });
});

module.exports = app;
