/**
 * SIGPA — API Gateway
 * Configuración de la Aplicación Express
 */
'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { perimeterAuth } = require('./middleware/authMiddleware');
const healthRoutes = require('./routes/healthRoutes');
const gatewayRoutes = require('./routes/gatewayRoutes');

const app = express();

// ── Cabeceras CORS Unificadas para Clientes Web ────────────────────────
app.use(cors(config.cors));

// ── Parsers de Carga Útil (Payload) ───────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rutas de Salud del Gateway ─────────────────────────────────────────
app.use(healthRoutes);

// ── Autenticación Perimetral JWT ───────────────────────────────────────
// Otorga paso a rutas públicas (login, health, docs) y exige Bearer token al resto
app.use(perimeterAuth);

// ── Enrutamiento hacia Microservicios Downstream ───────────────────────
app.use(gatewayRoutes);

// ── Manejador de Rutas No Mapeadas ────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Ruta no encontrada en API Gateway: ${req.method} ${req.originalUrl}`
    });
});

// ── Manejo Centralizado de Excepciones del Gateway ─────────────────────
app.use((err, req, res, next) => {
    console.error('[GATEWAY] Error no controlado:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno en API Gateway'
    });
});

module.exports = app;
