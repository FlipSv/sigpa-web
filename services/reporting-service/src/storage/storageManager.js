/**
 * SIGPA — Document & Reporting Microservice
 * Decoupled Document Storage Manager
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StorageManager {
    constructor(storageDir) {
        this.storageDir = storageDir || path.resolve(__dirname, '../../storage/reports');
        this.indexPath = path.join(this.storageDir, 'index.json');
        this._initStorage();
    }

    _initStorage() {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
        if (!fs.existsSync(this.indexPath)) {
            fs.writeFileSync(this.indexPath, JSON.stringify([], null, 2), 'utf8');
        }
    }

    _readIndex() {
        try {
            if (!fs.existsSync(this.indexPath)) return [];
            const data = fs.readFileSync(this.indexPath, 'utf8');
            return JSON.parse(data || '[]');
        } catch (err) {
            console.error('[STORAGE] Error leyendo índice de reportes:', err.message);
            return [];
        }
    }

    _writeIndex(indexData) {
        try {
            fs.writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2), 'utf8');
        } catch (err) {
            console.error('[STORAGE] Error guardando índice de reportes:', err.message);
        }
    }

    /**
     * Guarda un reporte generado en el almacenamiento desacoplado
     * @param {Object} params
     * @param {string} params.type - 'VISITA' | 'ACTA_CIERRE'
     * @param {string} [params.reportId]
     * @param {string} [params.filename]
     * @param {Buffer} params.buffer
     * @param {Object} [params.metadata]
     * @returns {Object} Reporte almacenado
     */
    async saveReport({ type, reportId, filename, buffer, metadata = {} }) {
        this._initStorage();
        const id = (reportId && typeof reportId === 'string' && /^[a-zA-Z0-9_-]+$/.test(reportId))
            ? reportId
            : crypto.randomUUID();
        const fname = filename || `reporte-${type.toLowerCase()}-${id.slice(0, 8)}.pdf`;
        const filePath = path.join(this.storageDir, `${id}.pdf`);

        await fs.promises.writeFile(filePath, buffer);

        const record = {
            id,
            type,
            filename: fname,
            size: buffer.length,
            createdAt: new Date().toISOString(),
            metadata: {
                estudiante: metadata.estudiante || 'N/A',
                tutor: metadata.tutor || 'N/A',
                institucion: metadata.institucion || 'N/A',
                fecha: metadata.fecha || new Date().toISOString().split('T')[0],
                ...metadata
            }
        };

        const index = this._readIndex();
        // Evitar duplicados por id
        const filtered = index.filter(item => item.id !== id);
        filtered.unshift(record);
        this._writeIndex(filtered);

        return {
            ...record,
            filePath,
            url: `/api/v1/reports/${id}`
        };
    }

    /**
     * Recupera un reporte por su identificador único
     * @param {string} reportId
     * @returns {Object|null}
     */
    getReportById(reportId) {
        if (!reportId || typeof reportId !== 'string') {
            return null;
        }

        // Validación estricta contra Directory Traversal
        if (!/^[a-zA-Z0-9_-]+$/.test(reportId)) {
            return null;
        }

        this._initStorage();
        const index = this._readIndex();
        const meta = index.find(item => item.id === reportId);
        const filePath = path.join(this.storageDir, `${reportId}.pdf`);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        const stat = fs.statSync(filePath);
        return {
            id: reportId,
            filename: meta ? meta.filename : `reporte-${reportId.slice(0, 8)}.pdf`,
            type: meta ? meta.type : 'DESCONOCIDO',
            size: stat.size,
            createdAt: meta ? meta.createdAt : stat.birthtime.toISOString(),
            metadata: meta ? meta.metadata : {},
            filePath
        };
    }

    /**
     * Lee el buffer del archivo de reporte
     * @param {string} reportId
     * @returns {Buffer|null}
     */
    getReportBuffer(reportId) {
        const report = this.getReportById(reportId);
        if (!report) return null;
        return fs.readFileSync(report.filePath);
    }

    /**
     * Retorna todos los reportes almacenados
     * @returns {Array}
     */
    listReports() {
        return this._readIndex();
    }

    /**
     * Retorna el conteo de reportes almacenados
     * @returns {number}
     */
    count() {
        return this._readIndex().length;
    }
}

module.exports = StorageManager;
