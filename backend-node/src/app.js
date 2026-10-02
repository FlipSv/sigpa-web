/**
 * SIGPA — Servidor Principal Express (Node.js)
 * Conexión Exclusiva a Oracle 10g con Fail-Fast
 *
 * Sistema de Gestión de Prácticas Académicas
 * Universidad de Investigación y Desarrollo (UDI)
 */
'use strict';

require('dotenv').config();
const path    = require('path');
const fs      = require('fs');
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const { initPool, closePool, executeQuery } = require('./config/database');
const { errorHandler } = require('./middlewares/errorHandler');

const authRoutes       = require('./routes/auth.routes');
const directorRoutes   = require('./routes/director.routes');
const estudianteRoutes = require('./routes/estudiante.routes');
const tutorRoutes      = require('./routes/tutor.routes');
const asesorRoutes     = require('./routes/asesor.routes');

const app  = express();
const PORT = process.env.PORT || 8081;

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
            message: 'Conexión a Oracle 10g activa y verificada',
            motor: 'Oracle Database 10g',
            version: verRes.rows[0].BANNER,
            tables: tblRes.rows.map(t => t.TABLE_NAME),
            totalUsuarios: userCount,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Error al consultar Oracle 10g: ' + err.message,
        });
    }
});

// ── Rutas de la API REST ───────────────────────────────────────────────
app.use('/api',            authRoutes);
app.use('/api/director',    directorRoutes);
app.use('/api/estudiante',  estudianteRoutes);
app.use('/api/tutor',       tutorRoutes);
app.use('/api/coordinador', tutorRoutes); // Compatibilidad con rutas heredadas
app.use('/api/asesor',      asesorRoutes);

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
        // Inicialización obligatoria de Oracle (si falla, database.js hace process.exit(1))
        await initPool();

        app.listen(PORT, () => {
            console.log(`[API] Endpoints RESTful en: http://localhost:${PORT}/api`);
            console.log(`[VISTA] Aplicación disponible en: http://localhost:${PORT}`);
            console.log(`[TEST] Diagnóstico Oracle en: http://localhost:${PORT}/api/test-db`);
            console.log('====================================================');
        });
    } catch (err) {
        console.error('[SERVER] Fallo al iniciar servidor:', err.message);
        process.exit(1);
    }
}

// Cierre ordenado de conexiones
process.on('SIGINT', async () => {
    console.log('\n[SERVER] Deteniendo servidor...');
    await closePool();
    process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = app;
