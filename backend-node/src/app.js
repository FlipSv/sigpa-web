/**
 * SIGPA — Servidor Principal Express (Node.js)
 * Conexión Exclusiva a Oracle 10g con Fail-Fast
 *
 * Sistema de Gestión de Prácticas Académicas
 * Universidad de Investigación y Desarrollo (UDI)
 */
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

const { initPool, closePool, executeQuery, isMockMode } = require('./config/database');
const { errorHandler } = require('./middlewares/errorHandler');
const { apiRateLimiter } = require('./middlewares/rateLimiter');

const authRoutes = require('./routes/auth.routes');
const directorRoutes = require('./routes/director.routes');
const estudianteRoutes = require('./routes/estudiante.routes');
const tutorRoutes = require('./routes/tutor.routes');
const asesorRoutes = require('./routes/asesor.routes');

const app = express();
const PORT = process.env.PORT || 8081;

// ── Cabeceras de Seguridad (Helmet) ────────────────────────────────────
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                scriptSrcAttr: ["'unsafe-inline'"], // <-- AGREGAR ESTA LÍNEA
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdn.jsdelivr.net",
                ],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// ── Middlewares Generales ──────────────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// ── Rate Limiting General para la API ──────────────────────────────────
app.use('/api', apiRateLimiter);

// ── Health Check / Test DB (Oracle 10g) ────────────────────────────────
app.get('/api/test-db', async (req, res) => {
    try {
        const verRes = await executeQuery('SELECT BANNER FROM v$version WHERE ROWNUM = 1');
        const tblRes = await executeQuery('SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME');
        let userCount = 0;
        try {
            const uRes = await executeQuery('SELECT COUNT(*) AS CNT FROM USUARIO');
            userCount = uRes.rows[0].CNT;
        } catch (e) {
            userCount = 'Tabla USUARIO no creada aún (ejecuta npm run setup-db)';
        }

        res.json({
            success: true,
            message: isMockMode
                ? 'Conexión a SQLite activa (Modo Mock de Desarrollo sin Oracle)'
                : 'Conexión a Oracle 10g activa y verificada',
            motor: isMockMode ? 'SQLite 3 (Modo Mock)' : 'Oracle Database 10g',
            version: verRes.rows[0].BANNER,
            tables: tblRes.rows.map(t => t.TABLE_NAME),
            totalUsuarios: userCount,
            modoMock: Boolean(isMockMode),
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Error al consultar base de datos: ' + err.message,
        });
    }
});

// ── Rutas de la API REST ───────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api/director', directorRoutes);
app.use('/api/estudiante', estudianteRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/coordinador', tutorRoutes); // Compatibilidad con rutas heredadas
app.use('/api/asesor', asesorRoutes);

// ── Servidor de Archivos Estáticos (Frontend) ──────────────────────────
const frontendCandidates = [
    process.env.FRONTEND_PATH ? path.resolve(__dirname, process.env.FRONTEND_PATH) : null,
    path.resolve(__dirname, '../../frontend'),
    path.resolve(__dirname, '../frontend'),
].filter(Boolean);

let frontendDir = null;
for (const cand of frontendCandidates) {
    if (fs.existsSync(cand)) {
        frontendDir = cand;
        break;
    }
}

if (frontendDir) {
    console.log(`[VISTA] Sirviendo archivos estáticos desde: ${frontendDir}`);
    app.use(express.static(frontendDir));

    // Fallback para rutas directas
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        const indexPath = path.join(frontendDir, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            next();
        }
    });
} else {
    console.warn('[VISTA] Advertencia: No se encontró la carpeta frontend.');
}

// ── Manejo Centralizado de Errores ─────────────────────────────────────
app.use(errorHandler);

// ── Iniciar Servidor con Fail-Fast para Oracle ──────────────────────────
async function startServer() {
    try {
        // Inicialización de Oracle (no bloquea el arranque del servidor web)
        try {
            await initPool();
        } catch (dbErr) {
            console.warn('[ORACLE] Base de datos no disponible de inmediato. El servidor web iniciará normalmente.');
        }

        app.listen(PORT, () => {
            console.log('====================================================');
            console.log(`[API] Endpoints RESTful en: http://localhost:${PORT}/api`);
            console.log(`[VISTA] Aplicación disponible en: http://localhost:${PORT}`);
            console.log(`[DB] Motor activo: ${isMockMode ? 'SQLite 3 (Modo Mock / sigpa.db)' : 'Oracle Database 10g (Modo Thick)'}`);
            console.log(`[TEST] Diagnóstico DB en: http://localhost:${PORT}/api/test-db`);
            console.log('====================================================');
        });
    } catch (err) {
        console.error('[SERVER] Fallo al iniciar servidor:', err.message);
        process.exit(1);
    }
}

// Cierre ordenado de conexiones
async function gracefulShutdown(signal) {
    console.log(`\n[SERVER] Señal ${signal} recibida. Deteniendo servidor y liberando recursos...`);
    await closePool();
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = app;
