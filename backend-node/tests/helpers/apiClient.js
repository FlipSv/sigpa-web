/**
 * SIGPA — Test Helper: Opaque-Box HTTP API Client
 * 
 * Lightweight HTTP client using native Node.js fetch with methods:
 * get, post, put, delete, auth token handling (setToken, clearToken),
 * query parameter serialization, and automatic JSON / binary parsing.
 */
'use strict';

class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = (baseUrl || 'http://127.0.0.1:8081').replace(/\/$/, '');
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    clearToken() {
        this.token = null;
    }

    /**
     * Authenticates with credentials and automatically sets bearer token on success.
     */
    async login(email, contrasena = '1234') {
        const res = await this.post('/api/login', { email, contrasena });
        if (res.ok && res.data && res.data.token) {
            this.setToken(res.data.token);
        }
        return res;
    }

    /**
     * Generic HTTP request execution over native fetch.
     */
    async request(method, endpoint, { body = null, headers = {}, query = null } = {}) {
        let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

        if (query && typeof query === 'object') {
            const q = new URLSearchParams();
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined && v !== null) {
                    q.append(k, String(v));
                }
            }
            const qs = q.toString();
            if (qs) {
                url += (url.includes('?') ? '&' : '?') + qs;
            }
        }

        const reqHeaders = { ...headers };
        if (this.token && !reqHeaders['Authorization'] && !reqHeaders['authorization']) {
            reqHeaders['Authorization'] = `Bearer ${this.token}`;
        }

        let reqBody = undefined;
        if (body !== null && body !== undefined) {
            if (typeof body === 'object' && !(body instanceof Buffer)) {
                reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
                reqBody = JSON.stringify(body);
            } else {
                reqBody = body;
            }
        }

        let res;
        let lastErr;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                res = await fetch(url, {
                    method,
                    headers: reqHeaders,
                    body: reqBody,
                });
                break;
            } catch (err) {
                lastErr = err;
                if (attempt < 3 && (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed'))) {
                    await new Promise(r => setTimeout(r, 25 * (attempt + 1)));
                    continue;
                }
                throw err;
            }
        }

        const contentType = res.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            try {
                data = await res.json();
            } catch (err) {
                data = null;
            }
        } else if (contentType.includes('text/')) {
            data = await res.text();
        } else {
            const arrayBuf = await res.arrayBuffer();
            data = Buffer.from(arrayBuf);
        }

        return {
            status: res.status,
            ok: res.ok,
            headers: res.headers,
            data,
            body: data, // convenience alias
        };
    }

    get(endpoint, options = {}) {
        return this.request('GET', endpoint, options);
    }

    post(endpoint, body, options = {}) {
        return this.request('POST', endpoint, { ...options, body });
    }

    put(endpoint, body, options = {}) {
        return this.request('PUT', endpoint, { ...options, body });
    }

    delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, options);
    }
}

function createApiClient(baseUrl) {
    return new ApiClient(baseUrl);
}

module.exports = {
    ApiClient,
    createApiClient,
};
