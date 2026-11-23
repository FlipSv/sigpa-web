/**
 * SIGPA — Lógica del Cliente v2.0
 * Arquitectura UX/UI por Rol: Director · Tutor · Asesor · Estudiante
 * Universidad de Investigación y Desarrollo (UDI) — 2026-II
 */

'use strict';

const API_BASE = window.location.origin.startsWith('http')
    ? `${window.location.origin}/api`
    : 'http://localhost:8081/api';

/* ═══════════════════════════════════════════════════════════════════════
   HTTP INTERCEPTOR (JWT & AUTH HEADER)
   Inyecta automáticamente 'Authorization: Bearer <token>' en todas las
   peticiones hacia la API y gestiona el vencimiento de sesión (401).
   ═══════════════════════════════════════════════════════════════════════ */
(function setupFetchInterceptor() {
    const _originalFetch = window.fetch;
    window.fetch = async function(resource, init = {}) {
        const token = sessionStorage.getItem('sigpa_token') || localStorage.getItem('sigpa_token');
        const urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
        const isApi = urlStr.includes('/api') || (typeof API_BASE === 'string' && urlStr.startsWith(API_BASE));

        if (token && isApi) {
            init = init || {};
            const headers = new Headers(init.headers || {});
            if (!headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${token}`);
            }
            init.headers = headers;
        }

        const response = await _originalFetch(resource, init);

        // Si el backend responde 401 y la petición es a la API (no login), redirigir
        if (response.status === 401 && isApi && !urlStr.includes('/login')) {
            console.warn('[AUTH] Sesión expirada o token no autorizado (401). Redirigiendo a login...');
            sessionStorage.removeItem('sigpa_token');
            sessionStorage.removeItem('sigpa_user');
            localStorage.removeItem('sigpa_token');
            localStorage.removeItem('sigpa_user');
            if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
                window.location.href = 'index.html?session_expired=1';
            }
        }

        return response;
    };
})();

/* ═══════════════════════════════════════════════════════════════════════
   ALERTAS Y MODALES INSTITUCIONALES (UDI — SWEETALERT2 & FALLBACK DOM)
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Muestra una alerta institucional estilizada con la identidad visual de la UDI.
 * Si SweetAlert2 está cargado, lo utiliza con la paleta de la universidad.
 * Si no está disponible (modo offline o bloqueo CDN), usa un modal institucional en el DOM.
 * @param {string|Object} title - Título del diálogo o payload de opciones
 * @param {string} [message] - Mensaje a mostrar
 * @param {'info'|'success'|'warning'|'error'|'question'} [icon='info'] - Tipo de alerta
 * @param {Object} [customOptions={}] - Opciones adicionales
 * @returns {Promise<any>}
 */
function sigpaAlert(title, message, icon = 'info', customOptions = {}) {
    if (typeof title === 'object' && title !== null) {
        customOptions = title;
        title = customOptions.title || 'Notificación SIGPA';
        message = customOptions.text || customOptions.message || customOptions.html || '';
        icon = customOptions.icon || 'info';
    }

    const cleanMsg = String(message || '').replace(/^[⚠️✅ℹ️❌❓]\s*/, '');
    const cleanTitle = String(title || 'Notificación SIGPA').replace(/^[⚠️✅ℹ️❌❓]\s*/, '');

    if (typeof Swal !== 'undefined') {
        return Swal.fire({
            title: cleanTitle,
            text: cleanMsg,
            icon: icon,
            confirmButtonText: customOptions.confirmButtonText || 'Entendido',
            confirmButtonColor: '#0f2b5c',
            customClass: {
                popup: 'sigpa-swal-popup',
                title: 'sigpa-swal-title',
                confirmButton: 'sigpa-swal-confirm-btn',
            },
            ...customOptions
        });
    }

    return _sigpaDomModal({
        title: cleanTitle,
        message: cleanMsg,
        icon: icon,
        confirmText: customOptions.confirmButtonText || 'Entendido'
    });
}

/**
 * Muestra un modal de confirmación institucional asíncrono (reemplazo de confirm() nativo).
 * @param {string} title
 * @param {string} message
 * @param {string} [confirmText='Confirmar']
 * @param {string} [cancelText='Cancelar']
 * @param {'warning'|'question'|'info'} [icon='warning']
 * @returns {Promise<boolean>}
 */
async function sigpaConfirm(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', icon = 'warning') {
    const cleanMsg = String(message || '').replace(/^[⚠️✅ℹ️❌❓]\s*/, '');
    const cleanTitle = String(title || 'Confirmar Acción').replace(/^[⚠️✅ℹ️❌❓]\s*/, '');

    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            title: cleanTitle,
            text: cleanMsg,
            icon: icon,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            confirmButtonColor: '#0f2b5c',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
            focusCancel: true,
            customClass: {
                popup: 'sigpa-swal-popup',
                title: 'sigpa-swal-title',
                confirmButton: 'sigpa-swal-confirm-btn',
                cancelButton: 'sigpa-swal-cancel-btn',
            }
        });
        return Boolean(res.isConfirmed);
    }

    return new Promise(resolve => {
        _sigpaDomModal({
            title: cleanTitle,
            message: cleanMsg,
            icon: icon,
            showCancel: true,
            confirmText: confirmText,
            cancelText: cancelText,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
}

/**
 * Notificación tipo Toast rápida en la esquina superior derecha
 * @param {string} message
 * @param {'success'|'info'|'warning'|'error'} [icon='success']
 */
function sigpaToast(message, icon = 'success') {
    const cleanMsg = String(message || '').replace(/^[⚠️✅ℹ️❌❓]\s*/, '');
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        return Toast.fire({ icon, title: cleanMsg });
    }
    console.log(`[SIGPA Toast - ${icon}]: ${cleanMsg}`);
}

/**
 * Renderizador de modal DOM fallback en caso de bloqueo de red CDN
 */
function _sigpaDomModal(opts) {
    const overlay = document.createElement('div');
    overlay.className = 'sigpa-modal-fallback-overlay';

    const iconsMap = {
        success: '✓',
        error: '✕',
        warning: '!',
        info: 'ℹ',
        question: '?'
    };
    const iconChar = iconsMap[opts.icon] || 'ℹ';

    overlay.innerHTML = `
        <div class="sigpa-modal-fallback-card" onclick="event.stopPropagation()">
            <div class="sigpa-modal-fallback-icon ${opts.icon || 'info'}">
                ${iconChar}
            </div>
            <h4 class="sigpa-modal-fallback-title">${opts.title || 'SIGPA UDI'}</h4>
            <p class="sigpa-modal-fallback-msg">${opts.message || ''}</p>
            <div class="sigpa-modal-fallback-actions">
                ${opts.showCancel ? `<button type="button" class="btn-secondary sigpa-cancel-btn" style="min-width:100px;">${opts.cancelText || 'Cancelar'}</button>` : ''}
                <button type="button" class="btn-primary-sm sigpa-confirm-btn" style="min-width:110px;">${opts.confirmText || 'Entendido'}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    return new Promise(resolve => {
        const removeModal = (result) => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            resolve(result);
        };

        const confirmBtn = overlay.querySelector('.sigpa-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (opts.onConfirm) opts.onConfirm();
                removeModal(true);
            });
            confirmBtn.focus();
        }

        const cancelBtn = overlay.querySelector('.sigpa-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (opts.onCancel) opts.onCancel();
                removeModal(false);
            });
        }

        overlay.addEventListener('click', () => {
            if (opts.showCancel) {
                if (opts.onCancel) opts.onCancel();
                removeModal(false);
            } else {
                removeModal(true);
            }
        });
    });
}

// Sobrescribir window.alert nativo globalmente para redirigir cualquier alerta no controlada
if (!window._nativeAlert) {
    window._nativeAlert = window.alert;
    window.alert = function(msg) {
        sigpaAlert('Notificación Institucional', msg, 'info');
    };
}

/* ═══════════════════════════════════════════════════════════════════════
   CHART.JS GLOBAL CONFIG
   ═══════════════════════════════════════════════════════════════════════ */
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size   = 12;
    Chart.defaults.color       = '#64748b';
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
    Chart.defaults.plugins.tooltip.titleColor       = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor        = '#cbd5e1';
    Chart.defaults.plugins.tooltip.padding          = 10;
    Chart.defaults.plugins.tooltip.cornerRadius     = 8;
    Chart.defaults.plugins.tooltip.displayColors    = true;
    Chart.defaults.scale.grid.color = 'rgba(226,232,240,.6)';
    Chart.defaults.scale.grid.drawBorder = false;
}

/* Global chart registry to destroy before re-render */
const _charts = {};

function destroyChart(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTH HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
function fillDemo(email, pass) {
    const emailInput = document.getElementById('email');
    const passInput  = document.getElementById('contrasena');
    if (emailInput && passInput) { emailInput.value = email; passInput.value = pass; }
}

async function handleLogin(e) {
    e.preventDefault();
    const email     = document.getElementById('email').value.trim();
    const contrasena = document.getElementById('contrasena').value.trim();
    const msgBox    = document.getElementById('loginMsg');
    const btn       = document.getElementById('btnSubmit');

    msgBox.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Verificando...';

    try {
        const res  = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, contrasena })
        });
        const data = await res.json();
        if (data.success) {
            if (data.token) {
                sessionStorage.setItem('sigpa_token', data.token);
                localStorage.setItem('sigpa_token', data.token);
            }
            sessionStorage.setItem('sigpa_user', JSON.stringify(data.usuario));
            localStorage.setItem('sigpa_user', JSON.stringify(data.usuario));
            window.location.href = 'dashboard.html';
        } else {
            msgBox.className = 'alert-box alert-danger';
            msgBox.textContent = data.message || 'Credenciales incorrectas. Intenta de nuevo.';
            msgBox.style.display = 'block';
        }
    } catch (err) {
        msgBox.className = 'alert-box alert-danger';
        msgBox.textContent = 'No se pudo conectar al servidor en ' + API_BASE + '. Verifica que el backend esté activo.';
        msgBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Iniciar Sesión</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    }
}

function logout() {
    sessionStorage.removeItem('sigpa_token');
    sessionStorage.removeItem('sigpa_user');
    localStorage.removeItem('sigpa_token');
    localStorage.removeItem('sigpa_user');
    window.location.replace('index.html');
}

function getToken() {
    return sessionStorage.getItem('sigpa_token') || localStorage.getItem('sigpa_token');
}

function getCurrentUser() {
    const u = sessionStorage.getItem('sigpa_user') || localStorage.getItem('sigpa_user');
    return u ? JSON.parse(u) : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   RESOLUCIÓN DE ENLACES DE EVIDENCIAS & NAVEGACIÓN RESPONSIVE
   ═══════════════════════════════════════════════════════════════════════ */
function resolveEvidenceUrl(url) {
    if (!url) return '';
    const clean = String(url).trim();
    if (clean === '#' || clean === '') return '';
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.startsWith('/uploads/')) return clean;
    if (clean.startsWith('uploads/')) return '/' + clean;
    return `/uploads/evidencias/${clean}`;
}

function toggleMobileNav() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;
    const isAct = sidebar.classList.contains('active') || sidebar.classList.contains('open');
    if (isAct) {
        closeMobileNav();
    } else {
        sidebar.classList.add('active', 'open');
        if (overlay) overlay.classList.add('active', 'open');
    }
}

function closeMobileNav() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active', 'open');
    if (overlay) overlay.classList.remove('active', 'open');
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('dashboard.html')) return;

    const user = getCurrentUser();
    if (!user || !getToken()) { window.location.replace('index.html'); return; }

    const rol = (user.rol || '').toUpperCase();

    /* ── Mobile Hamburger & Navigation Listeners ── */
    const btnHam = document.getElementById('btnHamburger');
    if (btnHam) {
        btnHam.addEventListener('click', toggleMobileNav);
    }
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeMobileNav);
    }
    window.addEventListener('resize', () => {
        if (window.innerWidth > 640) closeMobileNav();
    });

    /* ── Populate sidebar user info ── */
    document.getElementById('navUserName').textContent  = user.nombre || '—';
    document.getElementById('navUserRole').textContent  = rol;

    const initials = (user.nombre || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarColors = {
        DIRECTOR:   'linear-gradient(135deg,#4f46e5,#818cf8)',
        TUTOR:      'linear-gradient(135deg,#d97706,#fbbf24)',
        ASESOR:     'linear-gradient(135deg,#7c3aed,#a78bfa)',
        ESTUDIANTE: 'linear-gradient(135deg,#059669,#34d399)',
        COORDINADOR:'linear-gradient(135deg,#0284c7,#38bdf8)',
    };
    const color = avatarColors[rol] || 'linear-gradient(135deg,#64748b,#94a3b8)';

    document.getElementById('navUserAvatar').textContent  = initials;
    document.getElementById('navUserAvatar').style.background = color;

    /* ── Populate topbar ── */
    document.getElementById('topbarUserName').textContent = user.nombre || '—';
    document.getElementById('topbarUserRole').textContent = rol;
    document.getElementById('topbarAvatar').textContent   = initials;
    document.getElementById('topbarAvatar').style.background = color;

    const roleBadge = document.getElementById('roleBadge');
    roleBadge.textContent  = rol;
    roleBadge.className    = `topbar-badge badge-${rol.toLowerCase()}`;

    if (rol !== 'DIRECTOR') document.getElementById('notifDot').style.display = 'block';

    setupRoleNav(user);
    setupResponsiveSidebar();
});

function setupResponsiveSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const close = document.getElementById('sidebarClose');
    const backdrop = document.getElementById('sidebarBackdrop');
    const main = document.querySelector('.main-wrapper');
    const narrow = window.matchMedia('(max-width: 900px)');

    function setOpen(open, restoreFocus = true) {
        sidebar.classList.toggle('is-open', open);
        backdrop.hidden = !open;
        main.inert = open;
        document.body.classList.toggle('sidebar-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus();
        else if (restoreFocus && narrow.matches) toggle.focus();
    }

    toggle.addEventListener('click', () => setOpen(true));
    close.addEventListener('click', () => setOpen(false));
    backdrop.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', event => {
        if (narrow.matches && event.target.closest('.nav-item')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !backdrop.hidden) setOpen(false);
    });
    narrow.addEventListener('change', () => setOpen(false, !backdrop.hidden));
}

/* ═══════════════════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION — per role
   ═══════════════════════════════════════════════════════════════════════ */
function navItem(icon, label, onclick, badge = '') {
    return `<button class="nav-item" onclick="${onclick}">
                <span class="nav-icon">${icon}</span>
                <span>${label}</span>
                ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
            </button>`;
}

function navLabel(text) {
    return `<div class="nav-section-label">${text}</div>`;
}

function setActive(btn) {
    document.querySelectorAll('#sidebarNav .nav-item').forEach(el => el.classList.remove('active'));
    if (btn && btn.classList) btn.classList.add('active');
    if (window.innerWidth <= 640) closeMobileNav();
}

function setupRoleNav(user) {
    const nav = document.getElementById('sidebarNav');
    const rol = (user.rol || '').toUpperCase();

    if (['DIRECTOR', 'TUTOR', 'COORDINADOR'].includes(rol)) {
        const campana = document.getElementById('btn-notifs');
        if (campana) {
            campana.setAttribute('role', 'button');
            campana.setAttribute('aria-label', 'Notificaciones');
            campana.tabIndex = 0;
            campana.onclick = () => mostrarNotificacionesAcademicas(rol);
            campana.onkeydown = event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    campana.click();
                }
            };
        }
    }

    if (rol === 'DIRECTOR') {
        nav.innerHTML = `
            ${navLabel('GENERAL')}
            ${navItem('📊', 'Dashboard & KPIs',      "loadDirectorView('kpis', event.currentTarget)")}
            ${navLabel('GESTIÓN ACADÉMICA')}
            ${navItem('📚', 'Prácticas Pedagógicas', "loadDirectorView('practicas', event.currentTarget)")}
            ${navItem('🏫', 'Instituciones & Convenios',"loadDirectorView('instituciones', event.currentTarget)")}
            ${navItem('👥', 'Asignaciones & Cupos',  "loadDirectorView('asignaciones', event.currentTarget)")}
            ${navLabel('REPORTES')}
            ${navItem('📥', 'Exportar Informes', "loadDirectorView('informes', event.currentTarget)")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        setTopbarCTA('➕', 'Nueva Práctica', "openModalNuevaPractica()");
        loadDirectorView('kpis');

    } else if (rol === 'ESTUDIANTE') {
        nav.innerHTML = `
            ${navLabel('ACOMPAÑAMIENTO PEDAGÓGICO')}
            ${navItem('📊', 'Mi Práctica & Semáforo',    "loadEstudianteView('resumen', event.currentTarget)")}
            ${navItem('✍️',  'Asistente de Planeación',   "loadEstudianteView('bitacora', event.currentTarget)")}
            ${navItem('📁', 'Portafolio de Evidencias',  "loadEstudianteView('portafolio', event.currentTarget)")}
            ${navItem('🧭', 'Línea de Tiempo (Timeline)',"loadEstudianteView('timeline', event.currentTarget)")}
            ${navLabel('EVALUACIÓN')}
            ${navItem('⭐', 'Mis Calificaciones',        "loadEstudianteView('evaluaciones', event.currentTarget)")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        setTopbarCTA('✍️', 'Nueva Planeación', "loadEstudianteView('bitacora')");
        loadEstudianteView('resumen');

    } else if (rol === 'TUTOR' || rol === 'COORDINADOR') {
        nav.innerHTML = `
            ${navLabel('SEGUIMIENTO')}
            ${navItem('📝', 'Bitácoras',  "loadTutorView('bitacoras', event.currentTarget)")}
            ${navItem('👥', 'Mis Practicantes',       "loadTutorView('estudiantes', event.currentTarget)")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        loadTutorView('bitacoras');

    } else if (rol === 'ASESOR') {
        nav.innerHTML = `
            ${navLabel('IN SITU')}
            ${navItem('🏫', 'Practicantes en Aula',   "loadAsesorView('estudiantes', event.currentTarget)")}
            ${navItem('🔍', 'Bitácoras & Visitas',    "loadAsesorView('bitacoras', event.currentTarget)")}
            ${navLabel('REPORTES')}
            ${navItem('📋', 'Reporte de Avales',      "abrirModalReportes('ASESOR')")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        loadAsesorView('estudiantes');
    }
}

function setTopbarCTA(icon, label, onclick) {
    document.getElementById('topbarCTA').innerHTML =
        `<button class="btn-quick-action" onclick="${onclick}" id="topbar-cta-btn">
            ${icon} ${label}
        </button>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED UI HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
function trendBadge(pct) {
    if (pct === null || pct === undefined) return `<span class="kpi-trend trend-flat">— —</span>`;
    const up = pct >= 0;
    return `<span class="kpi-trend ${up ? 'trend-up' : 'trend-down'}">${up ? '↑' : '↓'} ${Math.abs(pct)}%</span>`;
}

function kpiCard(colorClass, iconClass, icon, label, value, sub, trend, delay = 0) {
    return `
        <div class="kpi-card ${colorClass}" style="animation-delay:${delay}s">
            <div class="kpi-header">
                <span class="kpi-label">${label}</span>
                <div class="kpi-icon ${iconClass}">${icon}</div>
            </div>
            <div class="kpi-value">${value}</div>
            <div class="kpi-footer">
                <span class="kpi-sub">${sub}</span>
                ${trendBadge(trend)}
            </div>
        </div>`;
}

function progressBarCell(value, max, colorClass = 'fill-accent') {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const fillClass = pct >= 75 ? 'fill-success' : pct >= 40 ? 'fill-accent' : 'fill-danger';
    return `<div class="progress-with-label">
                <div class="progress-label-row">
                    <span>${value}/${max} hrs</span>
                    <span>${pct}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${fillClass}" style="width:${pct}%"></div>
                </div>
            </div>`;
}

function donutSVG(segments, size = 120) {
    /* segments: [{color, pct, label}] */
    const r = 45, cx = 60, cy = 60;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    let paths = '';
    segments.forEach(s => {
        const dash  = (s.pct / 100) * circ;
        const gap   = circ - dash;
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}"
            fill="none"
            stroke="${s.color}"
            stroke-width="16"
            stroke-dasharray="${dash} ${gap}"
            stroke-dashoffset="${-(offset / 100) * circ}"
            stroke-linecap="butt"/>`;
        offset += s.pct;
    });
    return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" style="transform:rotate(-90deg)">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="16"/>
        ${paths}
    </svg>`;
}

function pageTitle(title, subtitle) {
    document.getElementById('pageTitle').textContent   = title;
    document.getElementById('pageSubtitle').textContent = subtitle || 'SIGPA — UDI 2026-II';
}

function loadingState() {
    return `<div style="padding:48px;text-align:center;color:#94a3b8;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             style="animation:spin 1s linear infinite;margin-bottom:12px;display:inline-block">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <p style="font-size:14px;font-weight:600;">Cargando datos...</p>
    </div>`;
}

function errorState(msg) {
    return `<div class="alert-box alert-danger" style="margin:0;">
        ⚠️ ${msg}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   ██████████  VISTA: DIRECTOR  ██████████
   ═══════════════════════════════════════════════════════════════════════ */

async function loadDirectorView(tab, btn) {
    if (btn) setActive(btn);
    const main = document.getElementById('mainView');
    pageTitle('Panel de Dirección de Programa', 'Visión estratégica e institucional');

    if (tab === 'kpis') {
        main.innerHTML = loadingState();
        try {
            const [kpi, practicas, asigs] = await Promise.all([
                leerDatosAcademicos('/director/kpis'),
                leerDatosAcademicos('/director/practicas'),
                leerDatosAcademicos('/director/asignaciones'),
            ]);

            /* ── KPI Calculation ── */
            const totalEst   = kpi.totalEstudiantes || kpi.estudiantes || 0;
            const totalHrs   = kpi.totalHoras || kpi.horas || 0;
            const convenios  = kpi.conveniosActivos || kpi.convenios || 0;
            const cupos      = kpi.cuposDisponibles || kpi.cupos || 0;

            /* ── Estado de practicantes para donut ── */
            const enEjec    = asigs.filter(a => a.aprobacion === 'APROBADA').length;
            const enPend    = asigs.filter(a => a.aprobacion === 'PENDIENTE').length;
            const totalAsig = asigs.length;

            main.innerHTML = `
            <!-- KPI Row -->
            <div class="kpi-row">
                ${kpiCard('kpi-accent','kpi-icon-accent','👥','Estudiantes Activos', totalEst, 'Cuentas activas', null, .05)}
                ${kpiCard('kpi-success','kpi-icon-success','⏱️','Horas Validadas', `${totalHrs} hrs`, 'Certificadas por tutores', null, .10)}
                ${kpiCard('kpi-teal','kpi-icon-teal','📜','Convenios Vigentes', convenios, 'Instituciones receptoras', null, .15)}
                ${kpiCard('kpi-warning','kpi-icon-warning','🪑','Cupos Disponibles', cupos, 'En instituciones con convenio vigente', null, .20)}
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions-bar">
                <span class="quick-actions-label">Acciones:</span>
                <button class="btn-primary-sm" onclick="openModalNuevaPractica()">➕ Nueva Práctica</button>
                <button class="btn-secondary" onclick="loadDirectorView('instituciones')">🏫 Registrar Institución</button>
                <button class="btn-secondary" onclick="openModalAsignarEstudiante()">👤 Asignar Estudiante</button>
                <button class="btn-secondary" onclick="loadDirectorView('informes')">📥 Exportar Informes</button>
            </div>

            <!-- Charts Row -->
            <div style="margin-bottom:20px;">
                <!-- Secondary Chart: Ocupación por práctica -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <div>
                            <div class="chart-card-title">Practicantes por Institución</div>
                            <div class="chart-card-subtitle">Ocupación de cupos asignados</div>
                        </div>
                    </div>
                    <div class="chart-card-body">
                        <div style="position:relative;height:240px;">
                            <canvas id="chartDirectorSecondary"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Row: Donut + Table -->
            <div class="bottom-row">
                <!-- Donut -->
                <div class="donut-card">
                    <div class="donut-card-header">
                        <div class="donut-card-title">Estado de Asignaciones</div>
                        <span class="status-badge status-brand">${totalAsig} total</span>
                    </div>
                    <div class="donut-wrapper">
                        ${donutSVG([
                            { color: '#10b981', pct: totalAsig ? Math.round(enEjec * 100 / totalAsig) : 0 },
                            { color: '#f59e0b', pct: totalAsig ? Math.round(enPend * 100 / totalAsig) : 0 },
                            { color: '#e2e8f0', pct: totalAsig ? Math.round((totalAsig - enEjec - enPend) * 100 / totalAsig) : 0 },
                        ], 140)}
                    </div>
                    <div class="donut-legend">
                        <div class="donut-legend-item">
                            <div class="donut-legend-label"><div class="donut-legend-dot" style="background:#10b981"></div>Aprobadas</div>
                            <span class="donut-legend-pct">${enEjec}</span>
                        </div>
                        <div class="donut-legend-item">
                            <div class="donut-legend-label"><div class="donut-legend-dot" style="background:#f59e0b"></div>Pendientes</div>
                            <span class="donut-legend-pct">${enPend}</span>
                        </div>
                        <div class="donut-legend-item">
                            <div class="donut-legend-label"><div class="donut-legend-dot" style="background:#e2e8f0"></div>Otras</div>
                            <span class="donut-legend-pct">${totalAsig - enEjec - enPend}</span>
                        </div>
                    </div>
                </div>

                <!-- Table: Prácticas -->
                <div class="table-card">
                    <div class="table-card-header">
                        <span class="table-card-title">Catálogo de Prácticas Pedagógicas</span>
                        <div class="table-card-actions">
                            <button class="btn-secondary" onclick="loadDirectorView('practicas')">Ver todas →</button>
                            <button class="btn-primary-sm" onclick="openModalNuevaPractica()">+ Nueva</button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Semestre</th>
                                    <th>Nombre de la Práctica</th>
                                    <th>Horas</th>
                                    <th>Practicantes</th>
                                    <th>Estado</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${practicas.slice(0, 6).map(p => `
                                <tr>
                                    <td><span class="status-badge status-brand">Sem ${p.semestre}</span></td>
                                    <td><strong style="font-size:13px;">${escaparAcademico(p.nombre)}</strong></td>
                                    <td><strong>${p.horas}</strong> hrs</td>
                                    <td><strong>${p.totalEstudiantes || 0}</strong> asignados</td>
                                    <td><span class="status-badge ${p.estado === 'ABIERTA' ? 'status-open' : 'status-closed'}">${p.estado}</span></td>
                                    <td>
                                        <button class="btn-${p.estado === 'ABIERTA' ? 'warning' : 'success'}-sm"
                                            onclick="cambiarEstadoPractica(${p.id}, '${p.estado === 'ABIERTA' ? 'CERRADA' : 'ABIERTA'}')">
                                            ${p.estado === 'ABIERTA' ? 'Cerrar' : 'Abrir'}
                                        </button>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

            /* ── Render Charts ── */
            _renderDirectorCharts(asigs);

        } catch (err) {
            main.innerHTML = errorState('Error al cargar el panel: ' + err.message);
        }

    } else if (tab === 'practicas') {
        main.innerHTML = loadingState();
        try {
            const practicas = await leerDatosAcademicos('/director/practicas');
            main.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Catálogo Completo de Prácticas Pedagógicas</h3>
                    <button class="btn-primary-sm" onclick="openModalNuevaPractica()">+ Nueva Práctica</button>
                </div>
                <div class="card-body table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Semestre</th><th>Nombre de la Práctica</th>
                            <th>Horas</th><th>Practicantes</th><th>Estado</th><th>Acción</th>
                        </tr></thead>
                        <tbody>
                            ${practicas.map(p => `
                            <tr>
                                <td><span class="status-badge status-brand">Sem ${p.semestre}</span></td>
                                <td><strong>${escaparAcademico(p.nombre)}</strong></td>
                                <td>${p.horas} hrs</td>
                                <td><strong>${p.totalEstudiantes}</strong></td>
                                <td><span class="status-badge ${p.estado === 'ABIERTA' ? 'status-open' : 'status-closed'}">${p.estado}</span></td>
                                <td>
                                    <button class="btn-${p.estado === 'ABIERTA' ? 'warning' : 'success'}-sm"
                                        onclick="cambiarEstadoPractica(${p.id}, '${p.estado === 'ABIERTA' ? 'CERRADA' : 'ABIERTA'}')">
                                        ${p.estado === 'ABIERTA' ? 'Cerrar' : 'Abrir'}
                                    </button>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        } catch (e) {
            main.innerHTML = errorState('Error al cargar prácticas: ' + e.message);
        }

    } else if (tab === 'instituciones') {
        main.innerHTML = loadingState();
        try {
            const res   = await fetch(`${API_BASE}/director/instituciones`);
            const insts = (await res.json()).data || [];
            main.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Instituciones Educativas Receptoras & Convenios</h3>
                    <button class="btn-primary-sm" onclick="openModalNuevaInstitucion()">+ Registrar Institución</button>
                </div>
                <div class="card-body table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Institución</th><th>Dirección & Contacto</th><th>Convenio</th>
                            <th>Cupos Ocupados</th><th>Vencimiento</th>
                        </tr></thead>
                        <tbody>
                            ${insts.map(i => {
                                const pct = i.cupos > 0 ? Math.round((i.estudiantesAsignados / i.cupos) * 100) : 0;
                                return `
                                <tr>
                                    <td><strong>${i.nombre}</strong></td>
                                    <td>${i.direccion}<br><small class="text-muted">📞 ${i.telefono}</small></td>
                                    <td><span class="status-badge ${i.vigente ? 'status-open' : 'status-closed'}">
                                        ${i.vigente ? 'VIGENTE' : 'SIN VIGENCIA'}</span></td>
                                    <td>
                                        <div class="progress-with-label">
                                            <div class="progress-label-row">
                                                <span>${i.estudiantesAsignados}/${i.cupos} cupos</span>
                                                <span>${pct}%</span>
                                            </div>
                                            <div class="progress-bar-bg">
                                                <div class="progress-bar-fill ${pct >= 80 ? 'fill-danger' : 'fill-accent'}" style="width:${pct}%"></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${i.vencimiento}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        } catch (e) {
            main.innerHTML = errorState('Error al cargar instituciones: ' + e.message);
        }

    } else if (tab === 'asignaciones') {
        main.innerHTML = loadingState();
        try {
            const asigs = await leerDatosAcademicos('/director/asignaciones');
            main.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Asignación Formal de Estudiantes a Instituciones</h3>
                    <button class="btn-primary-sm" onclick="openModalAsignarEstudiante()">+ Asignar Estudiante</button>
                </div>
                <div class="card-body table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Estudiante</th><th>Práctica</th><th>Institución</th>
                            <th>Tutor</th><th>Progreso de Horas</th><th>Estado</th><th>Aprobación</th>
                        </tr></thead>
                        <tbody>
                            ${asigs.map(a => `
                            <tr>
                                <td><strong>${escaparAcademico(a.estudiante)}</strong></td>
                                <td>${escaparAcademico(a.practica)}</td>
                                <td>${escaparAcademico(a.institucion || 'Sin asignar')}</td>
                                <td>${escaparAcademico(a.tutor || 'Sin tutor')}</td>
                                <td>${progressBarCell(a.horasAcumuladas, a.horasRequeridas)}</td>
                                <td><span class="status-badge ${a.estado === 'EN_CURSO' ? 'status-open' : 'status-pending'}">${a.estado}</span></td>
                                <td>${a.aprobacion === 'PENDIENTE' ? `
                                    <button class="btn-success-sm" onclick="resolverAsignacion(${a.id}, 'APROBADA')">Aprobar</button>
                                    <button class="btn-warning-sm" onclick="resolverAsignacion(${a.id}, 'RECHAZADA')">Rechazar</button>
                                ` : escaparAcademico(a.aprobacion || '?')}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        } catch (e) {
            main.innerHTML = errorState('Error al cargar asignaciones: ' + e.message);
        }

    } else if (tab === 'informes') {
        main.innerHTML = loadingState();
        try {
            const practicas = (await leerDatosAcademicos('/director/practicas')).filter(p => p.estado === 'ABIERTA');
            main.innerHTML = `
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Informe de Prácticas Disponibles</h3></div>
                    <div class="card-body">
                        ${practicas.length ? `
                            <form onsubmit="mostrarInformePractica(event)">
                                <label for="m-informe-practica">Práctica</label>
                                <select id="m-informe-practica" name="practica" required onchange="limpiarInformePractica()">
                                    <option value="">Seleccione una práctica</option>
                                    ${practicas.map(p => optionAcademica(p.semestre, `${p.nombre} · Semestre ${p.semestre}`)).join('')}
                                </select>
                                <button class="btn-primary-sm" type="submit">Consultar</button>
                            </form>` : '<p>No hay prácticas abiertas.</p>'}
                        <div id="resultadoInformePractica"></div>
                    </div>
                </div>`;
        } catch (e) {
            main.innerHTML = errorState(e.message);
        }
    }
}

function _renderDirectorCharts(asigs) {
    if (typeof Chart !== 'function') return;
    /* Chart 2: Doughnut — estado por institución */
    destroyChart('dirSec');
    const ctxSec = document.getElementById('chartDirectorSecondary');
    if (ctxSec && asigs.length > 0) {
        /* Group by institución */
        const byInst = Object.create(null);
        asigs.forEach(a => {
            const k = (a.institucion || 'Sin asignar');
            byInst[k] = (byInst[k] || 0) + 1;
        });
        const colors = ['#4f46e5','#10b981','#f59e0b','#ef4444','#0d9488','#7c3aed','#0284c7'];
        _charts['dirSec'] = new Chart(ctxSec, {
            type: 'doughnut',
            data: {
                labels: Object.keys(byInst),
                datasets: [{
                    data: Object.values(byInst),
                    backgroundColor: colors,
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 6,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '68%',
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} estudiante(s)` } }
                }
            }
        });
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   ██████████  VISTA: ESTUDIANTE (ASISTENTE PEDAGÓGICO INTEGRAL)  ██████████
   ═══════════════════════════════════════════════════════════════════════ */

let _currentStepperStep = 1;
let _preguntasGuiaCargadas = [];

async function loadEstudianteView(tab, btn) {
    if (btn) setActive(btn);
    const main = document.getElementById('mainView');
    const user = getCurrentUser();
    pageTitle('Asistente de Acompañamiento en Prácticas Pedagógicas', 'Seguimiento formativo, planeación didáctica y evidencias');

    /* ═══════════════════════════════════════════════════════════════════
       1. VISTA: RESUMEN & MEDIDOR PREDICTIVO (SEMÁFORO)
       ═══════════════════════════════════════════════════════════════════ */
    if (tab === 'resumen') {
        main.innerHTML = loadingState();
        try {
            const [asigRes, progRes, bitRes] = await Promise.all([
                fetch(`${API_BASE}/estudiante/asignacion?id_estudiante=${user.id}`).then(r => r.json()),
                fetch(`${API_BASE}/estudiante/progreso?id_estudiante=${user.id}`).then(r => r.json()),
                fetch(`${API_BASE}/estudiante/bitacoras?id_estudiante=${user.id}`).then(r => r.json())
            ]);

            const data = asigRes.data;
            if (!data) {
                main.innerHTML = `<div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-title">Sin práctica asignada</div>
                    <p class="empty-state-desc">Aún no tienes una práctica asignada por la Dirección de Programa. Contacta a tu coordinador académico.</p>
                </div>`;
                return;
            }

            const prog = progRes.data || {
                porcentaje: Math.min(100, Math.round((data.horasAcumuladas / data.horasRequeridas) * 100)),
                semaforo: 'VERDE',
                semaforoEtiqueta: 'En Ritmo Óptimo',
                semaforoColor: '#10b981',
                semaforoMensaje: '¡Excelente ritmo! Estás cumpliendo tus horas pedagógicas dentro del cronograma previsto.',
                recomendacion: 'Continúa registrando tus bitácoras oportunamente con sus respectivas evidencias didácticas.',
                ritmoPromedio: 16,
                sesionesRealizadas: 0,
                sesionesEstimadasRestantes: 0,
                fechaEstimadaCulminacion: '—',
                diasEstimadosRestantes: 0,
            };

            const bitacoras = bitRes.data || [];
            const calificadas = bitacoras.filter(b => b.nota != null || b.estado === 'CALIFICADA' || b.estado === 'APROBADA');
            const pendientes = bitacoras.filter(b => b.estado === 'PENDIENTE');
            const rechazadas = bitacoras.filter(b => b.estado === 'RECHAZADA');

            const horasRegistradas = bitacoras.reduce((sum, b) => sum + Number(b.horas || 0), 0);
            const horasAprobadas = calificadas.reduce((sum, b) => sum + Number(b.horas || 0), 0);
            const horasPendientes = pendientes.reduce((sum, b) => sum + Number(b.horas || 0), 0);
            const horasRechazadas = rechazadas.reduce((sum, b) => sum + Number(b.horas || 0), 0);

            // Sincronizar horas aprobadas con datos del servidor asegurando consistencia total
            const horasValidadas = Math.max(horasAprobadas, Number(data.horasAcumuladas || 0));
            const metaHoras = Number(data.horasRequeridas || 64);
            const pctReal = metaHoras > 0 ? Math.min(100, Math.round((horasValidadas / metaHoras) * 100)) : 0;
            const horasFaltantes = Math.max(0, metaHoras - horasValidadas);

            const notasProm = calificadas.length > 0 
                ? (calificadas.reduce((s, b) => s + parseFloat(b.nota != null ? b.nota : 5.0), 0) / calificadas.length).toFixed(1)
                : '—';

            main.innerHTML = `
            <!-- KPI Row: Desglose transparente y cálculo exacto de horas -->
            <div class="kpi-row">
                ${kpiCard('kpi-accent','kpi-icon-accent','⏱️','Horas Aprobadas', `${horasValidadas}/${metaHoras} hrs`, `${horasRegistradas}h registradas (${horasPendientes}h en revisión, ${horasRechazadas}h rechazadas)`, null, .05)}
                ${kpiCard('kpi-success','kpi-icon-success','📈','Avance Formativo', `${pctReal}%`, `${horasFaltantes > 0 ? horasFaltantes + ' hrs restantes para 100%' : '¡100% de la meta cumplida!'}`, pctReal >= 50 ? 8 : null, .10)}
                ${kpiCard('kpi-teal','kpi-icon-teal','⭐','Promedio Académico', notasProm !== '—' ? `${notasProm}/5.0` : '—', `${calificadas.length} visitas evaluadas`, null, .15)}
                ${kpiCard('kpi-purple','kpi-icon-purple','📁','Diarios de Campo', bitacoras.length, `${horasRegistradas} hrs totales (${pendientes.length} pendientes)`, null, .20)}
            </div>

            <!-- 🚦 MEDIDOR PREDICTIVO / SEMÁFORO DE CUMPLIMIENTO -->
            <div class="predictive-card" style="margin-bottom: 24px;">
                <div class="predictive-header">
                    <div class="predictive-title-row">
                        <span style="font-size: 24px;">🚦</span>
                        <div>
                            <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">Medidor Predictivo de Horas</h3>
                            <small class="text-muted">Algoritmo de ritmo de asistencia y proyección de culminación</small>
                        </div>
                    </div>
                    <div class="semaforo-badge semaforo-${prog.semaforo.toLowerCase()}">
                        <span class="semaforo-dot"></span>
                        <span>${prog.semaforoEtiqueta}</span>
                    </div>
                </div>

                <div class="predictive-grid">
                    <div class="predictive-stat">
                        <div class="predictive-stat-label">Horas Faltantes</div>
                        <div class="predictive-stat-value" style="color: ${prog.semaforoColor};">${horasFaltantes} hrs</div>
                        <div class="predictive-stat-sub">de ${metaHoras} hrs requeridas</div>
                    </div>
                    <div class="predictive-stat">
                        <div class="predictive-stat-label">Ritmo Promedio</div>
                        <div class="predictive-stat-value">${prog.ritmoPromedio} hrs</div>
                        <div class="predictive-stat-sub">promedio por visita / sesión</div>
                    </div>
                    <div class="predictive-stat">
                        <div class="predictive-stat-label">Sesiones Faltantes</div>
                        <div class="predictive-stat-value">${prog.sesionesEstimadasRestantes}</div>
                        <div class="predictive-stat-sub">${prog.sesionesRealizadas} realizadas a la fecha</div>
                    </div>
                    <div class="predictive-stat">
                        <div class="predictive-stat-label">Proyección Culminación</div>
                        <div class="predictive-stat-value" style="font-size: 18px; color: var(--accent);">${prog.fechaEstimadaCulminacion || '2026-11-30'}</div>
                        <div class="predictive-stat-sub">${prog.diasEstimadosRestantes > 0 ? `aprox. ${prog.diasEstimadosRestantes} días restantes` : 'Meta alcanzada'}</div>
                    </div>
                </div>

                <div class="predictive-advice-box ${prog.semaforo === 'AMARILLO' ? 'advice-warning' : prog.semaforo === 'ROJO' ? 'advice-danger' : ''}">
                    <span style="font-size: 18px;">💡</span>
                    <div>
                        <strong>Diagnóstico Pedagógico:</strong> ${prog.semaforoMensaje}<br>
                        <span style="font-size: 12px; opacity: .9;"><strong>Recomendación UDI:</strong> ${prog.recomendacion}</span>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions-bar">
                <span class="quick-actions-label">Herramientas:</span>
                <button class="btn-primary-sm" onclick="loadEstudianteView('bitacora')">✍️ Asistente de Planeación</button>
                <button class="btn-secondary" onclick="loadEstudianteView('portafolio')">📁 Portafolio Digital</button>
                <button class="btn-secondary" onclick="loadEstudianteView('timeline')">🧭 Línea de Tiempo (Timeline)</button>
            </div>

            <!-- Charts Row -->
            <div class="chart-row-2col">
                <!-- Burnup Chart: Horas acumuladas -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <div>
                            <div class="chart-card-title">Curva de Avance de Horas (Burnup)</div>
                            <div class="chart-card-subtitle">Mis horas acumuladas vs. trayectoria ideal esperada</div>
                        </div>
                        <div class="chart-meta">
                            <div class="chart-meta-val">${prog.porcentaje}%</div>
                            <span class="kpi-trend ${prog.porcentaje >= 65 ? 'trend-up' : 'trend-down'}" style="margin-left:6px;">
                                ${prog.porcentaje >= 65 ? '↑ En ritmo' : '↓ Rezagado'}
                            </span>
                        </div>
                    </div>
                    <div class="chart-card-body">
                        <div class="chart-legend">
                            <div class="legend-item"><div class="legend-dot" style="background:#4f46e5"></div>Horas acumuladas reales</div>
                            <div class="legend-item"><div class="legend-dot" style="background:#e2e8f0;border:1px dashed #94a3b8"></div>Trayectoria ideal</div>
                        </div>
                        <div style="position:relative;height:210px;">
                            <canvas id="chartEstBurnup"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Radar: Competencias -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <div>
                            <div class="chart-card-title">Evaluación de Competencias Pedagógicas</div>
                            <div class="chart-card-subtitle">Retroalimentación consolidada del tutor y asesor in situ</div>
                        </div>
                    </div>
                    <div class="chart-card-body">
                        <div style="position:relative;height:230px;">
                            <canvas id="chartEstRadar"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Table: Bitácoras & Diarios de Campo -->
            <div class="table-card" style="margin-top: 20px;">
                <div class="table-card-header">
                    <span class="table-card-title">Historial de Diarios de Campo & Bitácoras</span>
                    <div class="table-card-actions">
                        <button class="btn-primary-sm" onclick="loadEstudianteView('bitacora')">✍️ Nueva Planeación</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Visita</th><th>Fecha</th><th>Horas</th>
                            <th>Estado</th><th>Calificación</th><th>Acción</th>
                        </tr></thead>
                        <tbody>
                            ${bitacoras.length === 0
                                ? `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:32px;">Aún no has registrado bitácoras. ¡Usa el Asistente Guiado para crear la primera!</td></tr>`
                                : bitacoras.map(b => `
                            <tr>
                                <td><strong>Visita ${b.visita}</strong></td>
                                <td>${b.fecha || '—'}</td>
                                <td><strong>${b.horas}</strong> hrs</td>
                                <td><span class="status-badge ${b.estado === 'CALIFICADA' ? 'status-open' : 'status-pending'}">${b.estado}</span></td>
                                <td>${b.nota
                                    ? `<strong style="color:var(--success)">${b.nota}/5.0</strong>`
                                    : `<span class="text-muted">En revisión</span>`}</td>
                                <td>
                                    <button class="btn-secondary" style="padding:4px 8px;font-size:11.5px;"
                                        onclick="loadEstudianteView('timeline')">👁️ Ver Timeline</button>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                ${data.semestre >= 5 ? `
                <div style="padding:14px 22px;background:#fffbeb;border-top:1px solid #fde68a;">
                    <p style="font-size:12.5px;color:#92400e;font-weight:600;">
                        🛡️ <strong>Requisito Normativo (Sem ${data.semestre}):</strong>
                        Debes adjuntar soporte de evidencias en PDF (Formatos P5/P6) o enlace al portafolio digital en cada sesión.
                    </p>
                </div>` : ''}
            </div>`;

            /* Render Charts */
            _renderEstudianteCharts(bitacoras, metaHoras, horasValidadas, notasProm !== '—' ? notasProm : 3.8);

        } catch (e) {
            main.innerHTML = errorState('Error al cargar tu práctica: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       2. VISTA: ASISTENTE GUIADO DE PLANEACIÓN & DIARIO DE CAMPO (STEPPER)
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'bitacora') {
        main.innerHTML = loadingState();
        try {
            const asigRes  = await fetch(`${API_BASE}/estudiante/asignacion?id_estudiante=${user.id}`);
            const asigData = (await asigRes.json()).data;
            if (!asigData) {
                main.innerHTML = errorState('No tienes una práctica activa. Contacta a tu coordinador.');
                return;
            }

            _currentStepperStep = 1;

            main.innerHTML = `
            <div class="card" style="max-width: 960px; margin: 0 auto;">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">✍️ Asistente Guiado de Planeación y Diario de Campo</h3>
                        <p class="text-muted" style="font-size: 12.5px; margin-top: 2px;">
                            Estructuración pedagógica por momentos de clase según el modelo pedagógico UDI
                        </p>
                    </div>
                    <span class="status-badge status-brand">${asigData.practica} (Sem ${asigData.semestre})</span>
                </div>

                <div class="card-body">
                    <!-- Context banner -->
                    <div class="alert-box alert-info" style="margin-bottom: 24px;">
                        📍 <strong>Institución:</strong> ${asigData.institucion} &nbsp;|&nbsp;
                        👩‍🏫 <strong>Tutor Académico:</strong> ${asigData.tutor} &nbsp;|&nbsp;
                        ⏱️ <strong>Meta de Horas:</strong> ${asigData.horasAcumuladas}/${asigData.horasRequeridas} hrs
                    </div>

                    <!-- STEPPER NAVIGATION -->
                    <div class="stepper-container" id="stepperNav">
                        <div class="stepper-progress-bar" id="stepperProgress" style="width: 0%;"></div>
                        <button type="button" class="stepper-step active" onclick="stepperGo(1)">
                            <div class="step-circle">1</div>
                            <span class="step-label">Inicio / Motivación</span>
                        </button>
                        <button type="button" class="stepper-step" onclick="stepperGo(2)">
                            <div class="step-circle">2</div>
                            <span class="step-label">Desarrollo en Aula</span>
                        </button>
                        <button type="button" class="stepper-step" onclick="stepperGo(3)">
                            <div class="step-circle">3</div>
                            <span class="step-label">Cierre & Evaluación</span>
                        </button>
                        <button type="button" class="stepper-step" onclick="stepperGo(4)">
                            <div class="step-circle">4</div>
                            <span class="step-label">Reflexión & Evidencias</span>
                        </button>
                    </div>

                    <!-- STEPPER FORM -->
                    <form id="formAsistentePedagogico" onsubmit="handleGuardarBitacoraAsistente(event, ${asigData.idAsignacion}, ${asigData.idPractica})">

                        <!-- 🟡 PASO 1: DATOS & FASE DE INICIO -->
                        <div class="stepper-content" id="stepContent1">
                            <div class="moment-card">
                                <div class="moment-header">
                                    <span class="moment-badge moment-badge-inicio">🟡 Fase 1: Inicio y Motivación Didáctica</span>
                                </div>
                                <div class="moment-tip">
                                    <strong>Guía Pedagógica:</strong> Describe la ambientación del espacio, la contextualización de la temática y las dinámicas para activar los conocimientos previos de los niños.
                                </div>

                                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:16px;">
                                    <div>
                                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Número de Visita *</label>
                                        <div class="input-wrapper">
                                            <select id="b-visita" required onchange="cargarPreguntasGuiaEnStepper(${asigData.idPractica}, this.value)">
                                                <option value="1">Visita 1 — Diagnóstico y Contexto</option>
                                                <option value="2">Visita 2 — Intervención y Mediación</option>
                                                <option value="3">Visita 3 — Consolidación Curricular</option>
                                                <option value="4">Visita 4 — Cierre de Periodo</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Fecha de la Sesión *</label>
                                        <div class="input-wrapper">
                                            <input type="date" id="b-fecha" required
                                                max="${new Date().toISOString().split('T')[0]}"
                                                value="${new Date().toISOString().split('T')[0]}">
                                        </div>
                                        <small style="font-size:11px;color:#64748b;display:block;margin-top:3px;">📅 No se permiten fechas futuras</small>
                                    </div>
                                    <div>
                                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Horas Realizadas en Sesión * <span style="font-weight:500;color:#ea580c;">(Máx. 8h)</span></label>
                                        <div class="input-wrapper">
                                            <input type="number" id="b-horas" value="4" min="1" max="8" step="0.5" required placeholder="Ej. 4">
                                        </div>
                                        <small style="font-size:11px;color:#64748b;display:block;margin-top:3px;">⏱️ Máximo 8 horas por jornada</small>
                                    </div>
                                </div>

                                <div style="margin-bottom:12px;">
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Estrategias de Motivación & Activación de Saberes *</label>
                                    <div class="input-wrapper">
                                        <textarea id="b-inicio" rows="4" required placeholder="Ej. Se inició la sesión con la canción de bienvenida 'El tren de las vocales', captando la atención de los 22 estudiantes. Se presentó una caja sorpresa con elementos del contexto para indagar sus ideas previas..."></textarea>
                                    </div>
                                </div>
                            </div>

                            <div style="display:flex;justify-content:space-between;gap:10px;">
                                <button type="button" class="btn-secondary" onclick="loadEstudianteView('resumen')">← Volver al Resumen</button>
                                <button type="button" class="btn-primary-sm" onclick="stepperNext(1)">Continuar al Desarrollo ➔</button>
                            </div>
                        </div>

                        <!-- 🔵 PASO 2: FASE DE DESARROLLO EN AULA -->
                        <div class="stepper-content" id="stepContent2" style="display:none;">
                            <div class="moment-card">
                                <div class="moment-header">
                                    <span class="moment-badge moment-badge-desarrollo">🔵 Fase 2: Desarrollo y Mediación Pedagógica</span>
                                </div>
                                <div class="moment-tip">
                                    <strong>Guía Pedagógica:</strong> Detalla el núcleo de la actividad: qué hicieron los niños, cómo interactuaron con el material didáctico, qué retos surgieron y cómo guiaste el aprendizaje.
                                </div>

                                <div style="margin-bottom:12px;">
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Actividades Centrales Ejecutadas en Aula *</label>
                                    <div class="input-wrapper">
                                        <textarea id="b-desarrollo" rows="5" placeholder="Ej. Se organizaron 4 mesas de trabajo colaborativo. Cada grupo manipuló tarjetas sensoriales para asociar grafemas y fonemas. Se brindó acompañamiento individual a los estudiantes que requerían mayor andamiaje..."></textarea>
                                    </div>
                                </div>

                                <div style="margin-bottom:12px;">
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Material Didáctico y Recursos Empleados</label>
                                    <div class="input-wrapper">
                                        <input type="text" id="b-recursos" placeholder="Ej. Tarjetas táctiles, títeres de tela, fichas de conteo, guía de trabajo impresa...">
                                    </div>
                                </div>
                            </div>

                            <div style="display:flex;justify-content:space-between;gap:10px;">
                                <button type="button" class="btn-secondary" onclick="stepperPrev(2)">⬅ Anterior (Inicio)</button>
                                <button type="button" class="btn-primary-sm" onclick="stepperNext(2)">Continuar al Cierre ➔</button>
                            </div>
                        </div>

                        <!-- 🟢 PASO 3: FASE DE CIERRE & EVALUACIÓN -->
                        <div class="stepper-content" id="stepContent3" style="display:none;">
                            <div class="moment-card">
                                <div class="moment-header">
                                    <span class="moment-badge moment-badge-cierre">🟢 Fase 3: Cierre y Evaluación Formativa</span>
                                </div>
                                <div class="moment-tip">
                                    <strong>Guía Pedagógica:</strong> Explica cómo se consolidaron los aprendizajes, qué instrumentos o preguntas de evaluación formativa utilizaste y qué evidencias de logro demostraron los estudiantes.
                                </div>

                                <div style="margin-bottom:12px;">
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Estrategia de Cierre y Evidencias de Aprendizaje *</label>
                                    <div class="input-wrapper">
                                        <textarea id="b-cierre" rows="5" placeholder="Ej. Realizamos un círculo de diálogo ('El micrófono mágico') donde cada niño compartió su producción. Se evidenció que el 90% logró identificar los sonidos trabajados. Se concluyó con una reflexión sobre el trabajo en equipo..."></textarea>
                                    </div>
                                </div>
                            </div>

                            <div style="display:flex;justify-content:space-between;gap:10px;">
                                <button type="button" class="btn-secondary" onclick="stepperPrev(3)">⬅ Anterior (Desarrollo)</button>
                                <button type="button" class="btn-primary-sm" onclick="stepperNext(3)">Continuar a la Reflexión ➔</button>
                            </div>
                        </div>

                        <!-- 🟣 PASO 4: REFLEXIÓN DOCENTE & EVIDENCIAS -->
                        <div class="stepper-content" id="stepContent4" style="display:none;">
                            <div class="moment-card">
                                <div class="moment-header">
                                    <span class="moment-badge moment-badge-reflexion">🟣 Fase 4: Reflexión Docente & Portafolio de Evidencias</span>
                                </div>
                                <div class="moment-tip">
                                    <strong>Preguntas Orientadoras UDI:</strong> Responde con sentido crítico las preguntas guía asignadas para esta visita.
                                </div>

                                <!-- Preguntas Guía cargadas dinámicamente -->
                                <div id="contenedorPreguntasGuia" style="margin-bottom: 18px;">
                                    <div class="skeleton" style="height: 100px; width: 100%; border-radius: 8px;"></div>
                                </div>

                                <div style="margin-bottom:16px;">
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Reflexión Pedagógica Global del Practicante</label>
                                    <div class="input-wrapper">
                                        <textarea id="b-reflexion-extra" rows="3" placeholder="Aspectos a mejorar para la siguiente visita, aprendizajes como docente en formación..."></textarea>
                                    </div>
                                </div>

                                <div style="margin-bottom:14px;">
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">
                                        📁 Soporte de Evidencia Digital (Google Drive, OneDrive o Documento PDF) *
                                    </label>
                                    <div class="input-wrapper">
                                        <input type="text" id="b-evidencia" value="https://drive.google.com/drive/folders/evidencia_practica" required
                                            placeholder="Enlace de Google Drive, OneDrive o nombre de archivo PDF (ej. planeacion_visita_1.pdf)">
                                    </div>
                                    <small class="text-muted" style="font-size: 11.5px; display: block; margin-top: 4px;">
                                        Puedes vincular carpetas de fotos/videos didácticos, enlaces de Drive/OneDrive o subir el formato PDF P5/P6.
                                    </small>
                                </div>
                            </div>

                            <div style="display:flex;justify-content:space-between;gap:10px;">
                                <button type="button" class="btn-secondary" onclick="stepperPrev(4)">⬅ Anterior (Cierre)</button>
                                <button type="submit" class="btn-primary-sm" id="btnEnviarBitacora">📤 Enviar Diario de Campo al Tutor</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>`;

            // Cargar reactivamente preguntas guía para la visita inicial (1)
            cargarPreguntasGuiaEnStepper(asigData.idPractica, 1);

        } catch (e) {
            main.innerHTML = errorState('Error al cargar asistente: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       3. VISTA: PORTAFOLIO DIGITAL DE EVIDENCIAS INTEGRADO
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'portafolio') {
        main.innerHTML = loadingState();
        try {
            const res = await fetch(`${API_BASE}/estudiante/evidencias?id_estudiante=${user.id}`);
            const evidencias = (await res.json()).data || [];

            main.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">📁 Portafolio Digital de Evidencias Pedagógicas</h3>
                        <p class="text-muted" style="font-size: 12.5px; margin-top: 2px;">Repositorio institucional de planeaciones, materiales didácticos y soportes en aula</p>
                    </div>
                    <button class="btn-primary-sm" onclick="loadEstudianteView('bitacora')">➕ Vincular Nueva Evidencia</button>
                </div>

                <div class="card-body">
                    <!-- Filters -->
                    <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
                        <button class="btn-secondary" style="padding:5px 12px;font-size:12px;font-weight:700;" onclick="filtrarPortafolio('TODOS')">Todos (${evidencias.length})</button>
                        <button class="btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="filtrarPortafolio('GOOGLE_DRIVE')">📁 Google Drive</button>
                        <button class="btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="filtrarPortafolio('ONEDRIVE')">☁️ OneDrive</button>
                        <button class="btn-secondary" style="padding:5px 12px;font-size:12px;" onclick="filtrarPortafolio('PDF')">📄 Formatos PDF</button>
                    </div>

                    ${evidencias.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">📂</div>
                            <div class="empty-state-title">No hay evidencias registradas aún</div>
                            <p class="empty-state-desc">Al diligenciar tus bitácoras con el Asistente Guiado, tus enlaces de Google Drive, OneDrive o PDFs aparecerán aquí organizados.</p>
                            <button class="btn-primary-sm" style="margin-top:16px;" onclick="loadEstudianteView('bitacora')">Registrar Primera Evidencia</button>
                        </div>
                    ` : `
                        <div class="evidence-grid" id="evidenceCardsContainer">
                            ${evidencias.map(ev => `
                                <div class="evidence-card" data-tipo="${ev.tipo}">
                                    <div>
                                        <div class="evidence-header">
                                            <span class="evidence-type-badge evidence-type-${ev.tipo.toLowerCase()}">${ev.icono} ${ev.tipo.replace('_', ' ')}</span>
                                            <span class="status-badge ${ev.estado === 'CALIFICADA' ? 'status-open' : 'status-pending'}">${ev.estado}</span>
                                        </div>
                                        <div class="evidence-title">Soporte Pedagógico — Visita ${ev.visita}</div>
                                        <div class="evidence-meta">
                                            📅 <strong>Fecha:</strong> ${ev.fecha || 'Reciente'}<br>
                                            ⏱️ <strong>Horas validadas:</strong> ${ev.horas} hrs<br>
                                            🏫 <strong>Institución:</strong> ${ev.institucion || 'Colegio Sede'}
                                        </div>
                                        ${ev.nota ? `<div style="margin-bottom:12px;font-size:12.5px;color:var(--success);font-weight:700;">Calificación: ${ev.nota}/5.0</div>` : ''}
                                    </div>
                                    <div class="evidence-actions">
                                        <button class="btn-secondary" style="flex:1;font-size:12px;padding:6px 10px;"
                                            onclick="openModalPreviewEvidencia('${encodeURIComponent(ev.urlEvidencia)}', '${ev.tipo}', ${ev.visita}, '${ev.fecha}', '${ev.nota || ''}', '${ev.comentarios || ''}')">
                                            👁️ Previsualizar
                                        </button>
                                        <a href="${resolveEvidenceUrl(ev.urlEvidencia)}"
                                            target="_blank" rel="noopener noreferrer"
                                            class="btn-primary-sm" style="font-size:12px;padding:6px 10px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
                                            ↗ Abrir Evidencia
                                        </a>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>`;

        } catch (e) {
            main.innerHTML = errorState('Error al cargar portafolio de evidencias: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       4. VISTA: LÍNEA DE TIEMPO DE EVOLUCIÓN PEDAGÓGICA (TIMELINE)
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'timeline') {
        main.innerHTML = loadingState();
        try {
            const res = await fetch(`${API_BASE}/estudiante/timeline?id_estudiante=${user.id}`);
            const timeline = (await res.json()).data || [];

            main.innerHTML = `
            <div class="card" style="max-width: 960px; margin: 0 auto;">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">🧭 Línea de Tiempo de Evolución Pedagógica</h3>
                        <p class="text-muted" style="font-size: 12.5px; margin-top: 2px;">
                            Trayectoria cronológica de visitas, retroalimentación del Tutor Académico y Aval In Situ del Asesor
                        </p>
                    </div>
                    <button class="btn-primary-sm" onclick="loadEstudianteView('bitacora')">✍️ Nueva Visita</button>
                </div>

                <div class="card-body">
                    ${timeline.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">⏳</div>
                            <div class="empty-state-title">Aún no hay visitas en el historial</div>
                            <p class="empty-state-desc">Cada diario de campo registrado y evaluado formará parte de tu línea de tiempo formativa.</p>
                            <button class="btn-primary-sm" style="margin-top:16px;" onclick="loadEstudianteView('bitacora')">Registrar Visita 1</button>
                        </div>
                    ` : `
                        <div class="timeline-track">
                            ${timeline.map(item => {
                                const isCalificada = item.estado === 'CALIFICADA';
                                return `
                                <div class="timeline-item ${isCalificada ? 'calificada' : ''}">
                                    <div class="timeline-node">${item.visita}</div>
                                    <div class="timeline-card">
                                        <div class="timeline-card-header">
                                            <div>
                                                <h4 style="font-size: 15px; font-weight: 800; color: var(--text-main);">
                                                    Sesión Pedagógica — Visita ${item.visita}
                                                </h4>
                                                <small class="text-muted">📅 ${item.fecha || 'Sin fecha'} &nbsp;•&nbsp; ⏱️ ${item.horas} horas realizadas en aula</small>
                                            </div>
                                            <span class="status-badge ${isCalificada ? 'status-open' : 'status-pending'}">
                                                ${isCalificada ? '✓ Calificada y Avalada' : '⏳ Pendiente de Calificación'}
                                            </span>
                                        </div>

                                        <!-- Momentos Pedagógicos de la Sesión -->
                                        ${renderMomentoPedagogicoHTML(item.actividades, item.observaciones)}

                                        <!-- Evidencia vinculada -->
                                        ${item.evidencia ? `
                                        <div style="margin-bottom: 14px;">
                                            <a href="${resolveEvidenceUrl(item.evidencia)}" target="_blank" rel="noopener noreferrer"
                                                style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 600;">
                                                📎 Ver Soporte de Evidencia (${item.evidencia.length > 45 ? item.evidencia.substring(0,45) + '...' : item.evidencia}) ↗
                                            </a>
                                        </div>` : ''}

                                        <!-- DOBLE EVALUACIÓN: TUTOR & ASESOR IN SITU -->
                                        <div class="timeline-eval-block">
                                            <!-- Tutor Box -->
                                            <div class="eval-box eval-tutor">
                                                <div class="eval-box-header">
                                                    <span class="eval-box-title">🎓 Tutor Académico UDI: ${item.tutorEvaluacion ? item.tutorEvaluacion.evaluador : 'En asignación'}</span>
                                                    ${item.tutorEvaluacion && item.tutorEvaluacion.nota != null ? `<span class="eval-box-nota">${item.tutorEvaluacion.nota}/5.0</span>` : '<span class="text-muted" style="font-size:11px;">Pendiente</span>'}
                                                </div>
                                                <div class="eval-box-comment">
                                                    ${item.tutorEvaluacion && item.tutorEvaluacion.comentarios ? `"${item.tutorEvaluacion.comentarios}"` : 'El tutor aún no ha emitido su retroalimentación para esta visita.'}
                                                </div>
                                            </div>

                                            <!-- Asesor Box -->
                                            <div class="eval-box eval-asesor">
                                                <div class="eval-box-header">
                                                    <span class="eval-box-title">🏫 Asesor In Situ: ${item.asesorEvaluacion ? item.asesorEvaluacion.evaluador : 'Docente Titular'}</span>
                                                    ${item.asesorEvaluacion ? `<span class="status-badge status-brand" style="font-size:11px;">Aval Otorgado ✓</span>` : '<span class="text-muted" style="font-size:11px;">Pendiente aval</span>'}
                                                </div>
                                                <div class="eval-box-comment">
                                                    ${item.asesorEvaluacion && item.asesorEvaluacion.comentarios ? `"${item.asesorEvaluacion.comentarios}"` : 'Observación de desempeño in situ pendiente de registro en el colegio.'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>`;

        } catch (e) {
            main.innerHTML = errorState('Error al cargar línea de tiempo pedagógica: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       5. VISTA: MIS CALIFICACIONES
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'evaluaciones') {
        main.innerHTML = loadingState();
        try {
            const bRes      = await fetch(`${API_BASE}/estudiante/bitacoras?id_estudiante=${user.id}`);
            const bitacoras = (await bRes.json()).data || [];
            const calificadas = bitacoras.filter(b => b.nota != null);
            main.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">⭐ Mis Calificaciones y Retroalimentaciones</h3>
                    <span class="status-badge status-brand">${calificadas.length} visitas calificadas</span>
                </div>
                <div class="card-body table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Visita</th><th>Fecha</th><th>Horas</th><th>Calificación</th><th>Retroalimentación del Tutor</th>
                        </tr></thead>
                        <tbody>
                            ${calificadas.length === 0
                                ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">Aún no tienes bitácoras calificadas.</td></tr>`
                                : calificadas.map(b => `
                            <tr>
                                <td><strong>Visita ${b.visita}</strong></td>
                                <td>${b.fecha || '—'}</td>
                                <td>${b.horas} hrs</td>
                                <td><strong style="font-size:16px;color:var(--success)">${b.nota}</strong><span class="text-muted">/5.0</span></td>
                                <td><span class="text-muted" style="font-style:italic;">"${b.comentariosEvaluacion || 'Desempeño pedagógico acorde a los objetivos previstos.'}"</span></td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        } catch (e) {
            main.innerHTML = errorState('Error al cargar evaluaciones: ' + e.message);
        }
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   STEPPER INTERACTIVO — FUNCIONES DE CONTROL Y PREGUNTAS GUÍA
   ═══════════════════════════════════════════════════════════════════════ */

function stepperGo(step) {
    if (step < 1 || step > 4) return;

    // Validación al avanzar desde el Paso 1
    if (step > 1) {
        // Validación de fecha no futura
        const fechaEl = document.getElementById('b-fecha');
        if (fechaEl) {
            const fechaVal = fechaEl.value;
            if (!fechaVal) {
                sigpaAlert('Fecha Requerida', 'Por favor selecciona la fecha en la que realizaste la sesión de práctica pedagógica.', 'warning');
                return;
            }
            const hoy = new Date();
            hoy.setHours(23, 59, 59, 999);
            const fechaSesion = new Date(fechaVal + 'T00:00:00');
            if (fechaSesion > hoy) {
                sigpaAlert('Fecha No Válida', 'La fecha de la sesión no puede ser futura. Registra la fecha real de ejecución.', 'warning');
                return;
            }
        }

        // Validación de horas (máximo 8h por jornada)
        const horasEl = document.getElementById('b-horas');
        if (horasEl) {
            const horas = parseFloat(horasEl.value);
            if (isNaN(horas) || horas <= 0) {
                sigpaAlert('Horas Requeridas', 'Ingresa una cantidad de horas válida para la sesión (mínimo 1 hora).', 'warning');
                return;
            }
            if (horas > 8) {
                sigpaAlert('Límite de Horas Excedido', 'El reglamento institucional de prácticas prohíbe registrar más de 8 horas en una sola jornada pedagógica.', 'warning');
                return;
            }
        }

        if (!document.getElementById('b-inicio').value.trim()) {
            sigpaAlert('Fase 1 Incompleta', 'Debes diligenciar las estrategias de la Fase de Inicio y Motivación antes de continuar.', 'warning');
            return;
        }
    }

    if (step > 2 && !document.getElementById('b-desarrollo').value.trim()) {
        sigpaAlert('Fase 2 Incompleta', 'Debes diligenciar las actividades de la Fase de Desarrollo antes de continuar.', 'warning');
        return;
    }
    if (step > 3 && !document.getElementById('b-cierre').value.trim()) {
        sigpaAlert('Fase 3 Incompleta', 'Debes diligenciar la Fase de Cierre y Evaluación antes de continuar.', 'warning');
        return;
    }

    _currentStepperStep = step;

    // Ocultar todos los pasos
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`stepContent${i}`);
        if (el) el.style.display = i === step ? 'block' : 'none';
    }

    // Actualizar botones de navegación del stepper
    const steps = document.querySelectorAll('#stepperNav .stepper-step');
    steps.forEach((btn, idx) => {
        const num = idx + 1;
        btn.classList.remove('active', 'completed');
        if (num === step) {
            btn.classList.add('active');
        } else if (num < step) {
            btn.classList.add('completed');
        }
    });

    // Actualizar barra de progreso
    const progressBar = document.getElementById('stepperProgress');
    if (progressBar) {
        const pct = ((step - 1) / 3) * 100;
        progressBar.style.width = `${pct}%`;
    }
}

function stepperNext(current) {
    stepperGo(current + 1);
}

function stepperPrev(current) {
    stepperGo(current - 1);
}

async function cargarPreguntasGuiaEnStepper(idPractica, visita) {
    const container = document.getElementById('contenedorPreguntasGuia');
    if (!container) return;

    container.innerHTML = `<div class="skeleton" style="height: 60px; width: 100%; border-radius: 8px;"></div>`;

    try {
        const res = await fetch(`${API_BASE}/estudiante/preguntas-guia/${idPractica || 1}/${visita || 1}`);
        const data = await res.json();
        _preguntasGuiaCargadas = data.data || [];

        if (_preguntasGuiaCargadas.length === 0) {
            container.innerHTML = `<p class="text-muted" style="font-size:12.5px;">No hay preguntas guía específicas registradas para esta visita.</p>`;
            return;
        }

        container.innerHTML = `
            <div style="background: #fdf4ff; border: 1.5px solid #f5d0fe; border-radius: var(--r-md); padding: 16px; margin-bottom: 14px;">
                <h4 style="font-size: 13px; font-weight: 700; color: #86198f; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                    <span>🎯</span> Preguntas Guía para la Visita ${visita}
                </h4>
                ${_preguntasGuiaCargadas.map((p, idx) => `
                    <div style="margin-bottom: 12px;">
                        <label style="display:block;font-size:12.5px;font-weight:600;color:#701a75;margin-bottom:4px;">
                            ${idx + 1}. ${p.pregunta}
                        </label>
                        <div class="input-wrapper">
                            <textarea id="resp-pregunta-${p.id}" class="pregunta-guia-resp" rows="2" required
                                placeholder="Escribe tu reflexión pedagógica frente a esta pregunta..."></textarea>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p class="text-danger" style="font-size:12px;">Error al cargar preguntas guía: ${e.message}</p>`;
    }
}

async function handleGuardarBitacoraAsistente(e, idAsignacion, idPractica) {
    e.preventDefault();

    // Validar fecha no futura
    const fechaEl = document.getElementById('b-fecha');
    const fechaVal = fechaEl ? fechaEl.value : '';
    if (!fechaVal) {
        sigpaAlert('Fecha Requerida', 'Por favor indica la fecha en que se llevó a cabo la sesión de práctica pedagógica.', 'warning');
        return;
    }
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    const fechaSesion = new Date(fechaVal + 'T00:00:00');
    if (fechaSesion > hoy) {
        sigpaAlert('Fecha No Válida', 'La fecha de la sesión no puede ser una fecha futura. Registra la fecha real de intervención.', 'warning');
        return;
    }

    // Validar horas por jornada (máximo 8h)
    const horasEl = document.getElementById('b-horas');
    const horasNum = parseFloat(horasEl ? horasEl.value : 0);
    if (isNaN(horasNum) || horasNum <= 0) {
        sigpaAlert('Horas Requeridas', 'Ingresa una cantidad de horas válida para la sesión (mínimo 1 hora).', 'warning');
        return;
    }
    if (horasNum > 8) {
        sigpaAlert('Límite de Horas Excedido', 'El reglamento de prácticas de la UDI prohíbe registrar más de 8 horas en una sola jornada pedagógica.', 'warning');
        return;
    }

    const btn = document.getElementById('btnEnviarBitacora');
    if (btn) btn.disabled = true;

    // Recolectar respuestas a preguntas guía
    const respuestasGuias = [];
    _preguntasGuiaCargadas.forEach((p, idx) => {
        const inp = document.getElementById(`resp-pregunta-${p.id}`);
        if (inp && inp.value.trim()) {
            respuestasGuias.push(`P${idx + 1}: ${p.pregunta}\nR: ${inp.value.trim()}`);
        }
    });

    const extraReflexion = document.getElementById('b-reflexion-extra') ? document.getElementById('b-reflexion-extra').value.trim() : '';
    if (extraReflexion) {
        respuestasGuias.push(`Reflexión general: ${extraReflexion}`);
    }

    const payload = {
        id_asignacion: idAsignacion,
        visita: document.getElementById('b-visita').value,
        fecha: fechaVal,
        horas: horasNum,
        inicio_motivacion: document.getElementById('b-inicio').value.trim(),
        desarrollo: document.getElementById('b-desarrollo').value.trim(),
        cierre_evaluacion: document.getElementById('b-cierre').value.trim(),
        reflexion_docente: respuestasGuias.join('\n\n'),
        evidencia: document.getElementById('b-evidencia').value.trim(),
    };

    try {
        const res = await fetch(`${API_BASE}/estudiante/bitacora`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) {
            await sigpaAlert('¡Diario de Campo Registrado!', 'Tu bitácora y diario de campo pedagógico han sido guardados con éxito. Tu tutor académico ha recibido la notificación correspondiente.', 'success');
            loadEstudianteView('resumen');
        } else {
            sigpaAlert('Atención', d.message || 'Error al guardar la bitácora', 'warning');
            if (btn) btn.disabled = false;
        }
    } catch (err) {
        sigpaAlert('Error de Conexión', 'No fue posible registrar la bitácora: ' + err.message, 'error');
        if (btn) btn.disabled = false;
    }
}

function filtrarPortafolio(tipo) {
    const cards = document.querySelectorAll('#evidenceCardsContainer .evidence-card');
    cards.forEach(card => {
        const cardTipo = card.getAttribute('data-tipo');
        if (tipo === 'TODOS' || cardTipo === tipo) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function openModalPreviewEvidencia(encodedUrl, tipo, visita, fecha, nota, comentarios) {
    const url = decodeURIComponent(encodedUrl);
    const mc = document.getElementById('modalContainer');
    
    mc.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">👁️ Previsualizador de Evidencias — Visita ${visita}</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="alert-box alert-info" style="margin-bottom: 16px;">
                    <strong>Tipo de Soporte:</strong> ${tipo.replace('_', ' ')} &nbsp;|&nbsp; 
                    <strong>Fecha de Registro:</strong> ${fecha || 'Reciente'}
                </div>

                <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: var(--r-md); padding: 24px; text-align: center; margin-bottom: 16px;">
                    <div style="font-size: 42px; margin-bottom: 10px;">
                        ${tipo === 'GOOGLE_DRIVE' ? '📁' : tipo === 'ONEDRIVE' ? '☁️' : tipo === 'PDF' ? '📄' : '🔗'}
                    </div>
                    <h4 style="font-size: 14.5px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
                        Enlace del Soporte Académico
                    </h4>
                    <p style="font-size: 12.5px; color: #475569; word-break: break-all; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                        <code>${resolveEvidenceUrl(url)}</code>
                    </p>
                    <a href="${resolveEvidenceUrl(url)}" target="_blank" rel="noopener noreferrer"
                        class="btn-primary-sm" style="text-decoration:none;display:inline-block;">
                        ↗ Abrir en Nueva Pestaña Segura
                    </a>
                </div>

                ${nota ? `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px;">
                    <strong style="color: #166534; font-size: 13px;">Calificación del Tutor: ${nota}/5.0</strong>
                    ${comentarios ? `<p style="font-size: 12px; color: #166534; margin-top: 4px; font-style: italic;">"${comentarios}"</p>` : ''}
                </div>` : ''}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cerrar</button>
            </div>
        </div>
    </div>`;
}

/* ── Parser & Formatter de Momentos Pedagógicos ─────────────────────── */
function parseDataPedagogica(val) {
    if (!val) return null;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                // No es JSON válido, retornar como string
            }
        }
    }
    return val;
}

function renderMomentoPedagogicoHTML(actividadesRaw, observacionesRaw) {
    const act = parseDataPedagogica(actividadesRaw);
    const obs = parseDataPedagogica(observacionesRaw);

    let inicio = '';
    let desarrollo = '';
    let cierre = '';
    let reflexion = '';
    let general = '';

    // Si actividades es un objeto (o JSON parseado)
    if (act && typeof act === 'object') {
        inicio = act.inicio || act.inicio_motivacion || act.fase1 || '';
        desarrollo = act.desarrollo || act.actividades || act.fase2 || '';
        cierre = act.cierre || act.cierre_evaluacion || act.fase3 || '';
        if (act.reflexion || act.reflexion_docente) {
            reflexion = act.reflexion || act.reflexion_docente;
        }
        if (!inicio && !desarrollo && !cierre && !reflexion) {
            // Claves genéricas de objeto
            general = Object.entries(act).map(([k, v]) => `<strong>${k}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('<br>');
        }
    } else if (typeof act === 'string') {
        const str = act.trim();
        // Verificar si contiene encabezados estructurados
        if (str.includes('[FASE 1') || str.includes('[INICIO') || str.includes('[FASE 2') || str.includes('[DESARROLLO') || str.includes('[FASE 3') || str.includes('[CIERRE')) {
            const regexInicio = /\[(?:FASE 1 - )?(?:INICIO|MOTIVACIÓN)[^\]]*\]:?\s*([\s\S]*?)(?=\[(?:FASE 2|DESARROLLO|FASE 3|CIERRE)|$)/i;
            const regexDesarrollo = /\[(?:FASE 2 - )?DESARROLLO[^\]]*\]:?\s*([\s\S]*?)(?=\[(?:FASE 3|CIERRE)|$)/i;
            const regexCierre = /\[(?:FASE 3 - )?CIERRE[^\]]*\]:?\s*([\s\S]*?)$/i;

            const mInicio = str.match(regexInicio);
            const mDesarrollo = str.match(regexDesarrollo);
            const mCierre = str.match(regexCierre);

            if (mInicio && mInicio[1].trim()) inicio = mInicio[1].trim();
            if (mDesarrollo && mDesarrollo[1].trim()) desarrollo = mDesarrollo[1].trim();
            if (mCierre && mCierre[1].trim()) cierre = mCierre[1].trim();

            if (!inicio && !desarrollo && !cierre) {
                general = str;
            }
        } else {
            general = str;
        }
    }

    // Procesar observaciones y reflexiones docentes
    if (obs && typeof obs === 'object') {
        const refPart = obs.reflexion || obs.reflexion_docente || obs.respuestas || '';
        const obsPart = obs.observaciones || obs.comentarios || '';
        if (refPart) reflexion = typeof refPart === 'object' ? JSON.stringify(refPart) : String(refPart);
        if (obsPart) reflexion += (reflexion ? '\n\n' : '') + (typeof obsPart === 'object' ? JSON.stringify(obsPart) : String(obsPart));
        if (!reflexion) {
            reflexion = Object.entries(obs).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
        }
    } else if (typeof obs === 'string' && obs.trim()) {
        const obsStr = obs.trim();
        if (obsStr.includes('[REFLEXIÓN PEDAGÓGICA')) {
            const mRef = obsStr.match(/\[REFLEXIÓN PEDAGÓGICA[^\]]*\]:?\s*([\s\S]*?)(?=\[OBSERVACIONES ADICIONALES|$)/i);
            const mObs = obsStr.match(/\[OBSERVACIONES ADICIONALES[^\]]*\]:?\s*([\s\S]*?)$/i);
            if (mRef && mRef[1].trim()) reflexion = mRef[1].trim();
            if (mObs && mObs[1].trim()) {
                reflexion += (reflexion ? '\n\n' : '') + 'Observaciones: ' + mObs[1].trim();
            }
            if (!reflexion) reflexion = obsStr;
        } else {
            reflexion = obsStr;
        }
    }

    // Renderizar tarjetas estructuradas con diseño institucional sobrio
    const hasStructured = inicio || desarrollo || cierre || reflexion;

    if (hasStructured) {
        let html = '<div class="timeline-moments-list">';

        if (inicio) {
            html += `
            <div class="timeline-moment-card moment-inicio">
                <div class="timeline-moment-tag">FASE 1 · INICIO Y MOTIVACIÓN</div>
                <div class="timeline-moment-body">${inicio}</div>
            </div>`;
        }

        if (desarrollo) {
            html += `
            <div class="timeline-moment-card moment-desarrollo">
                <div class="timeline-moment-tag">FASE 2 · DESARROLLO EN AULA</div>
                <div class="timeline-moment-body">${desarrollo}</div>
            </div>`;
        }

        if (cierre) {
            html += `
            <div class="timeline-moment-card moment-cierre">
                <div class="timeline-moment-tag">FASE 3 · CIERRE Y EVALUACIÓN FORMATIVA</div>
                <div class="timeline-moment-body">${cierre}</div>
            </div>`;
        }

        if (reflexion) {
            html += `
            <div class="timeline-moment-card moment-reflexion">
                <div class="timeline-moment-tag">REFLEXIÓN DOCENTE & PREGUNTAS GUÍA</div>
                <div class="timeline-moment-body" style="font-style:italic;">${reflexion}</div>
            </div>`;
        }

        if (general) {
            html += `
            <div class="timeline-moment-card moment-general">
                <div class="timeline-moment-tag">ACTIVIDADES REGISTRADAS</div>
                <div class="timeline-moment-body">${general}</div>
            </div>`;
        }

        html += '</div>';
        return html;
    }

    // Fallback para texto simple (diseño sobrio)
    const textToShow = (typeof act === 'string' && act) ? act : (general || 'Sin descripción de actividades registradas.');
    return `
    <div class="timeline-moment-card moment-general" style="margin-bottom:12px;">
        <div class="timeline-moment-tag">ACTIVIDADES DE LA SESIÓN</div>
        <div class="timeline-moment-body">${textToShow}</div>
    </div>
    ${typeof obs === 'string' && obs.trim() ? `
    <div class="timeline-moment-card moment-reflexion" style="margin-bottom:12px;">
        <div class="timeline-moment-tag">REFLEXIÓN DOCENTE</div>
        <div class="timeline-moment-body" style="font-style:italic;">${obs}</div>
    </div>` : ''}`;
}

function _renderEstudianteCharts(bitacoras, metaHrs, actualHrs, avgNota) {


    /* Burnup Chart */
    destroyChart('estBurnup');
    const ctxBurnup = document.getElementById('chartEstBurnup');
    if (ctxBurnup) {
        const semanas   = 16;
        const ideal     = Array.from({ length: semanas }, (_, i) => Math.round(((i + 1) / semanas) * metaHrs));
        /* Real: spread bitácoras over 16 weeks progressively */
        const real = Array(semanas).fill(0);
        let acc = 0;
        bitacoras.forEach((b, i) => {
            acc += parseFloat(b.horas || 0);
            const week = Math.min(semanas - 1, i * 4 + 3);
            for (let w = week; w < semanas; w++) real[w] = acc;
        });

        _charts['estBurnup'] = new Chart(ctxBurnup, {
            type: 'line',
            data: {
                labels: Array.from({ length: semanas }, (_, i) => `S${i + 1}`),
                datasets: [
                    {
                        label: 'Real',
                        data: real,
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79,70,229,.1)',
                        tension: .4, fill: true,
                        pointRadius: 3, pointHoverRadius: 5,
                        borderWidth: 2.5,
                    },
                    {
                        label: 'Ideal',
                        data: ideal,
                        borderColor: '#cbd5e1',
                        borderDash: [6, 4],
                        tension: .2, fill: false,
                        pointRadius: 0, borderWidth: 1.5,
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
                    y: { max: metaHrs, ticks: { callback: v => v + 'h' } }
                }
            }
        });
    }

    /* Radar Chart */
    destroyChart('estRadar');
    const ctxRadar = document.getElementById('chartEstRadar');
    if (ctxRadar) {
        const nota = parseFloat(avgNota) || 3.5;
        _charts['estRadar'] = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['Dominio Pedagógico', 'Puntualidad', 'Liderazgo', 'Resolución', 'Ética', 'Comunicación'],
                datasets: [{
                    data: [
                        Math.min(5, nota + 0.2),
                        Math.min(5, nota + 0.5),
                        Math.min(5, nota - 0.3),
                        Math.min(5, nota + 0.1),
                        Math.min(5, nota + 0.4),
                        Math.min(5, nota - 0.1),
                    ],
                    backgroundColor: 'rgba(79,70,229,.15)',
                    borderColor: '#4f46e5',
                    borderWidth: 2,
                    pointBackgroundColor: '#4f46e5',
                    pointRadius: 4,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        min: 0, max: 5, ticks: { stepSize: 1, font: { size: 10 } },
                        grid: { color: 'rgba(226,232,240,.8)' },
                        pointLabels: { font: { size: 10.5, weight: '600' } }
                    }
                }
            }
        });
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   ██████████  VISTA: TUTOR ACADÉMICO  ██████████
   ═══════════════════════════════════════════════════════════════════════ */

async function loadTutorView(tab, btn) {
    if (btn) setActive(btn);
    const main = document.getElementById('mainView');
    const user = getCurrentUser();
    pageTitle('Panel del Tutor Académico', 'Seguimiento y calificación de practicantes');

    if (tab === 'bitacoras') {
        main.innerHTML = loadingState();
        try {
            const [bRes, aRes] = await Promise.all([
                fetch(`${API_BASE}/tutor/bitacoras?id_tutor=${user.id}`).then(r => r.json()),
                fetch(`${API_BASE}/tutor/asignaciones?id_tutor=${user.id}`).then(r => r.json()),
            ]);
            if (!bRes.success || !aRes.success) throw new Error(bRes.message || aRes.message);
            const bits = bRes.data || [];
            tutorBitacoras = new Map(bits.map(b => [b.id, b]));
            const asigs = aRes.data  || [];
            window._currentTutorBitacoras = bits;
            window._currentTutorAsigs = asigs;

            const calificadas = bits.filter(b => b.estado === 'CALIFICADA' || b.nota != null).length;
            const pendientes  = bits.length - calificadas;
            const enRiesgo    = asigs.filter(a => {
                const pct = a.horasRequeridas > 0 ? (a.horasAcumuladas / a.horasRequeridas) : 0;
                return pct < 0.5;
            }).length;

            main.innerHTML = `
            <!-- KPI Row -->
            <div class="kpi-row">
                ${kpiCard('kpi-danger','kpi-icon-danger','📝','Bitácoras por Calificar', pendientes, 'En cola de revisión', pendientes > 0 ? null : 0, .05)}
                ${kpiCard('kpi-accent','kpi-icon-accent','👥','Practicantes a Cargo', asigs.length, 'En el periodo activo', null, .10)}
                ${kpiCard('kpi-warning','kpi-icon-warning','⚠️','Estudiantes en Riesgo', enRiesgo, 'Avance <50% a la fecha', enRiesgo > 0 ? null : 0, .15)}
                ${kpiCard('kpi-success','kpi-icon-success','✅','Bitácoras Calificadas', calificadas, 'Procesadas en el periodo', calificadas > 0 ? 5 : null, .20)}
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions-bar">
                <span class="quick-actions-label">Acciones:</span>
                <button class="btn-primary-sm" onclick="sigpaAlert('Aprobación en Lote', 'La función de aprobación masiva de bitácoras sin observaciones se encuentra en desarrollo.', 'info')">✅ Aprobar Lote sin Observaciones</button>
                <button class="btn-secondary" onclick="loadTutorView('estudiantes')">👥 Ver Mis Practicantes</button>
            </div>

            <!-- Charts Row -->
            <div class="chart-row-2col">
                <!-- Main Chart: Progreso de horas por estudiante -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <div>
                            <div class="chart-card-title">Progreso de Horas por Practicante</div>
                            <div class="chart-card-subtitle">Horas acumuladas vs. meta requerida por estudiante</div>
                        </div>
                        <span class="kpi-trend ${enRiesgo === 0 ? 'trend-up' : 'trend-down'}">
                            ${enRiesgo === 0 ? '↑ Grupo al día' : `↓ ${enRiesgo} en riesgo`}
                        </span>
                    </div>
                    <div class="chart-card-body">
                        <div style="position:relative;height:${Math.max(200, asigs.length * 42)}px;">
                            <canvas id="chartTutorMain"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Secondary Chart: Estado de entregas -->
                <div class="chart-card">
                    <div class="chart-card-header">
                        <div>
                            <div class="chart-card-title">Estado de Entregas del Grupo</div>
                            <div class="chart-card-subtitle">Distribución de ${bits.length} bitácoras recibidas</div>
                        </div>
                    </div>
                    <div class="chart-card-body">
                        <div style="position:relative;height:220px;">
                            <canvas id="chartTutorSecondary"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Row -->
            <div class="bottom-row">
                <!-- Donut: distribución estados -->
                <div class="donut-card">
                    <div class="donut-card-header">
                        <div class="donut-card-title">Ratio de Revisión</div>
                        <span class="status-badge ${pendientes > 0 ? 'status-warning' : 'status-open'}">${pendientes > 0 ? 'Acción requerida' : 'Al día'}</span>
                    </div>
                    <div class="donut-wrapper">
                        ${donutSVG([
                            { color: '#10b981', pct: bits.length > 0 ? Math.round((calificadas / bits.length) * 100) : 0 },
                            { color: '#f59e0b', pct: bits.length > 0 ? Math.round((pendientes  / bits.length) * 100) : 100 },
                        ], 140)}
                    </div>
                    <div class="donut-legend">
                        <div class="donut-legend-item">
                            <div class="donut-legend-label"><div class="donut-legend-dot" style="background:#10b981"></div>Calificadas</div>
                            <span class="donut-legend-pct">${calificadas}</span>
                        </div>
                        <div class="donut-legend-item">
                            <div class="donut-legend-label"><div class="donut-legend-dot" style="background:#f59e0b"></div>Pendientes</div>
                            <span class="donut-legend-pct">${pendientes}</span>
                        </div>
                    </div>
                </div>

                <!-- Table: Bandeja de bitácoras -->
                <div class="table-card">
                    <div class="table-card-header">
                        <span class="table-card-title">Bandeja de Revisión de Bitácoras</span>
                        <div class="table-card-actions">
                            ${pendientes > 0 ? `<span class="status-badge status-warning">${pendientes} por revisar</span>` : ''}
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead><tr>
                                <th>Estudiante</th><th>Práctica & Institución</th><th>Bitácora</th>
                                <th>Horas</th><th>Estado</th><th>Nota</th><th>Acción</th>
                            </tr></thead>
                            <tbody>
                                ${bits.length === 0
                                    ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:#94a3b8;">No hay bitácoras recibidas aún.</td></tr>`
                                    : bits.map(b => `
                                <tr>
                                    <td><strong>${escaparAcademico(b.estudiante)}</strong></td>
                                    <td>${escaparAcademico(b.practica)}<br><small class="text-muted">${escaparAcademico(b.institucion)}</small></td>
                                    <td>Bitácora ${b.visita}</td>
                                    <td><strong>${b.horas}</strong> hrs</td>
                                    <td><span class="status-badge ${b.estado === 'CALIFICADA' ? 'status-graded' : 'status-pending'}">${b.estado}</span></td>
                                    <td>${b.nota != null ? `<strong style="color:var(--success)">${b.nota}</strong>` : '—'}</td>
                                    <td>
                                        <button class="btn-primary-sm" style="padding:5px 10px;font-size:12px;"
                                            onclick="openModalCalificar(${b.id})">
                                            ${b.estado === 'CALIFICADA' || b.nota != null ? 'Ver bitácora' : 'Calificar'}
                                        </button>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

            /* Charts */
            _renderTutorCharts(asigs, bits, calificadas, pendientes);

        } catch (e) {
            main.innerHTML = errorState('Error al cargar panel del tutor: ' + e.message);
        }

    } else if (tab === 'estudiantes') {
        main.innerHTML = loadingState();
        try {
            const res   = await fetch(`${API_BASE}/tutor/asignaciones?id_tutor=${user.id}`);
            const asigs = (await res.json()).data || [];
            main.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Practicantes Asignados bajo mi Supervisión</h3>
                    <span class="status-badge status-brand">${asigs.length} practicantes</span>
                </div>
                <div class="card-body table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Estudiante</th><th>Práctica</th><th>Institución</th>
                            <th>Progreso de Horas</th><th>Estado</th><th>Acciones</th>
                        </tr></thead>
                        <tbody>
                            ${asigs.map(a => `
                            <tr>
                                <td>
                                    <strong>${a.estudiante}</strong><br>
                                    <small class="text-muted">${a.email || ''}</small>
                                </td>
                                <td>${a.practica}</td>
                                <td>${a.institucion}</td>
                                <td>${progressBarCell(a.horasAcumuladas, a.horasRequeridas)}</td>
                                <td><span class="status-badge status-open">${a.estado}</span></td>
                                <td>
                                    <button class="btn-primary-sm" style="font-size:11.5px;padding:4px 8px;"
                                        onclick="descargarActaCierre({ idAsignacion: ${a.id}, estudiante: '${a.estudiante.replace(/'/g, "\\'")}', tutor: '${(user.nombre || '').replace(/'/g, "\\'")}', institucion: '${(a.institucion || '').replace(/'/g, "\\'")}', horasAcumuladas: ${a.horasAcumuladas}, horasRequeridas: ${a.horasRequeridas} })"
                                        title="Descargar Acta de Cierre en PDF">
                                        📄 Acta PDF
                                    </button>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        } catch (e) {
            main.innerHTML = errorState('Error al cargar estudiantes: ' + e.message);
        }
    }
}

function _renderTutorCharts(asigs, bits, calificadas, pendientes) {
    if (typeof Chart !== 'function') return;
    /* Horizontal Bar: progreso por estudiante */
    destroyChart('tutMain');
    const ctxMain = document.getElementById('chartTutorMain');
    if (ctxMain && asigs.length > 0) {
        _charts['tutMain'] = new Chart(ctxMain, {
            type: 'bar',
            data: {
                labels: asigs.map(a => a.estudiante.split(' ').slice(0, 2).join(' ')),
                datasets: [
                    {
                        label: 'Horas Acumuladas',
                        data: asigs.map(a => a.horasAcumuladas),
                        backgroundColor: asigs.map(a => {
                            const pct = a.horasRequeridas > 0 ? a.horasAcumuladas / a.horasRequeridas : 0;
                            return pct >= .7 ? '#10b981' : pct >= .4 ? '#4f46e5' : '#ef4444';
                        }),
                        borderRadius: 4,
                        borderSkipped: false,
                    },
                    {
                        label: 'Meta',
                        data: asigs.map(a => a.horasRequeridas),
                        backgroundColor: 'rgba(226,232,240,.5)',
                        borderRadius: 4,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} hrs` } }
                },
                scales: {
                    x: { ticks: { callback: v => v + 'h' } },
                    y: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }
        });
    }

    /* Doughnut: estados */
    destroyChart('tutSec');
    const ctxSec = document.getElementById('chartTutorSecondary');
    if (ctxSec) {
        _charts['tutSec'] = new Chart(ctxSec, {
            type: 'doughnut',
            data: {
                labels: ['Calificadas', 'Pendientes'],
                datasets: [{
                    data: [calificadas, pendientes],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11.5 } } }
                }
            }
        });
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   ██████████  VISTA: ASESOR IN SITU  ██████████
   ═══════════════════════════════════════════════════════════════════════ */

async function loadAsesorView(tab, btn) {
    if (btn) setActive(btn);
    const main = document.getElementById('mainView');
    pageTitle('Panel de Asesoría Pedagógica In Situ', 'Validación de visitas en instituciones educativas');

    main.innerHTML = loadingState();
    try {
        const res  = await fetch(`${API_BASE}/asesor/bitacoras`);
        const bits = (await res.json()).data || [];
        window._currentAsesorBitacoras = bits;

        const conAval  = bits.filter(b => b.comentarios).length;
        const sinAval  = bits.filter(b => !b.comentarios).length;
        const totalHrs = bits.reduce((s, b) => s + parseFloat(b.horas || 0), 0);

        /* Unique institutions */
        const instSet = new Set(bits.map(b => b.institucion));

        /* Group by institution for chart */
        const byInst = {};
        bits.forEach(b => {
            const k = b.institucion || 'Sin Institución';
            byInst[k] = (byInst[k] || 0) + 1;
        });

        main.innerHTML = `
        <!-- KPI Row -->
        <div class="kpi-row">
            ${kpiCard('kpi-accent','kpi-icon-accent','👩‍🏫','Practicantes en Aula', bits.length, 'Bajo supervisión in situ', null, .05)}
            ${kpiCard('kpi-warning','kpi-icon-warning','🔍','Visitas sin Aval', sinAval, 'Pendientes de validación', sinAval > 0 ? null : 0, .10)}
            ${kpiCard('kpi-success','kpi-icon-success','⏱️','Horas Avaladas', `${totalHrs} hrs`, 'Validadas in situ en el periodo', 6, .15)}
            ${kpiCard('kpi-teal','kpi-icon-teal','🏫','Instituciones Activas', instSet.size, 'Colegios con practicantes asignados', null, .20)}
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions-bar">
            <span class="quick-actions-label">Acciones:</span>
            <button class="btn-secondary" onclick="abrirModalReportes('ASESOR')">📋 Reporte de Avales PDF</button>
        </div>

        <!-- Charts Row -->
        <div class="chart-row-2col">
            <!-- Bar: visitas por institución -->
            <div class="chart-card">
                <div class="chart-card-header">
                    <div>
                        <div class="chart-card-title">Visitas por Institución</div>
                        <div class="chart-card-subtitle">Cantidad de bitácoras recibidas por sede</div>
                    </div>
                    <div class="chart-meta">
                        <div class="chart-meta-val">${bits.length}</div>
                        <span class="text-muted" style="font-size:12px;margin-left:4px;">visitas</span>
                    </div>
                </div>
                <div class="chart-card-body">
                    <div style="position:relative;height:230px;">
                        <canvas id="chartAsesorMain"></canvas>
                    </div>
                </div>
            </div>

            <!-- Donut: aval -->
            <div class="chart-card">
                <div class="chart-card-header">
                    <div>
                        <div class="chart-card-title">Estado de Avales</div>
                        <div class="chart-card-subtitle">Con y sin concepto in situ emitido</div>
                    </div>
                </div>
                <div class="chart-card-body" style="align-items:center;justify-content:center;">
                    <div style="position:relative;height:200px;">
                        <canvas id="chartAsesorSecondary"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Table Full Width -->
        <div class="table-card">
            <div class="table-card-header">
                <span class="table-card-title">Bandeja de Validación In Situ</span>
                <div class="table-card-actions">
                    ${sinAval > 0 ? `<span class="status-badge status-warning">${sinAval} pendientes de aval</span>` : '<span class="status-badge status-open">Todo avalado ✓</span>'}
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr>
                        <th>Practicante</th><th>Colegio / Institución</th><th>Visita</th>
                        <th>Horas</th><th>Concepto In Situ</th><th>Evidencia</th><th>Acción</th>
                    </tr></thead>
                    <tbody>
                        ${bits.length === 0
                            ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8;">No hay visitas registradas aún.</td></tr>`
                            : bits.map(b => `
                        <tr>
                            <td><strong>${b.estudiante}</strong></td>
                            <td>${b.institucion}</td>
                            <td>Visita ${b.visita}</td>
                            <td><strong>${b.horas}</strong> hrs</td>
                            <td>${b.comentarios
                                ? `<span class="text-muted" style="font-style:italic;">"${b.comentarios.substring(0, 60)}${b.comentarios.length > 60 ? '...' : ''}"</span>`
                                : `<span class="status-badge status-pending">Pendiente de aval</span>`}</td>
                            <td>
                                ${b.evidencia ? `<a href="${resolveEvidenceUrl(b.evidencia)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--accent);text-decoration:none;font-weight:600;" title="Ver archivo de evidencia">📎 Evidencia ↗</a>` : '<span class="text-muted" style="font-size:11.5px;">—</span>'}
                            </td>
                            <td>
                                <button class="btn-primary-sm" style="padding:5px 10px;font-size:12px;"
                                    onclick="openModalAsesorEval(${b.id}, '${b.estudiante.replace(/'/g, "\\'")}', ${b.visita})">
                                    ${b.comentarios ? '✏️ Editar Aval' : '✅ Validar Visita'}
                                </button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

        /* Charts */
        _renderAsesorCharts(byInst, conAval, sinAval);

    } catch (e) {
        main.innerHTML = errorState('Error al cargar panel del asesor: ' + e.message);
    }
}

function _renderAsesorCharts(byInst, conAval, sinAval) {
    destroyChart('aseMain');
    const ctxMain = document.getElementById('chartAsesorMain');
    if (ctxMain) {
        const labels = Object.keys(byInst);
        const data   = Object.values(byInst);
        const colors = ['#4f46e5','#10b981','#f59e0b','#0d9488','#7c3aed','#ef4444'];
        _charts['aseMain'] = new Chart(ctxMain, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Visitas',
                    data,
                    backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                    borderRadius: 8, borderSkipped: false,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxRotation: 20, font: { size: 11 } } },
                    y: { ticks: { stepSize: 1, font: { size: 11 } } }
                }
            }
        });
    }

    destroyChart('aseSec');
    const ctxSec = document.getElementById('chartAsesorSecondary');
    if (ctxSec) {
        _charts['aseSec'] = new Chart(ctxSec, {
            type: 'doughnut',
            data: {
                labels: ['Con Aval', 'Sin Aval'],
                datasets: [{
                    data: [conAval, sinAval],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 3, borderColor: '#fff', hoverOffset: 6,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 12 } } }
                }
            }
        });
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   DIRECTOR MODALS
   ═══════════════════════════════════════════════════════════════════════ */

async function cambiarEstadoPractica(id, nuevoEstado) {
    try {
        const res = await fetch(`${API_BASE}/director/cambiar_estado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, estado: nuevoEstado })
        });
        const d = await res.json();
        if (d.success) { loadDirectorView('kpis'); }
        else sigpaAlert('Estado de Práctica', d.message, 'warning');
    } catch (e) { sigpaAlert('Error de Conexión', e.message, 'error'); }
}

function escaparAcademico(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
}

function optionAcademica(value, label) {
    return `<option value="${escaparAcademico(value)}">${escaparAcademico(label)}</option>`;
}

function opcionesSemestres(semestres = [1, 2, 3]) {
    return '<option value="">Seleccione un semestre</option>' +
        semestres.map(n => optionAcademica(n, `Semestre ${n}`)).join('');
}

async function leerDatosAcademicos(path) {
    const response = await fetch(`${API_BASE}${path}`);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'No se pudieron cargar los datos');
    return result.data;
}

async function enviarDatosAcademicos(path, payload) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo guardar el cambio');
}

async function openModalNuevaPractica() {
    try {
        const practicas = await leerDatosAcademicos('/director/practicas');
        const semestres = [1, 2, 3].filter(n => !practicas.some(p => p.semestre === n));
        if (!semestres.length) {
            sigpaAlert('Nueva práctica', 'Los tres semestres ya tienen una práctica.', 'info');
            return;
        }
        document.getElementById('modalContainer').innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 class="modal-title">Nueva Práctica Pedagógica</h3>
                    <button class="btn-close" onclick="closeModal()">×</button>
                </div>
                <form onsubmit="guardarNuevaPractica(event)">
                    <div class="modal-body">
                        <label for="m-practica-semestre">Semestre</label>
                        <div class="input-wrapper"><select id="m-practica-semestre" name="semestre" required>${opcionesSemestres(semestres)}</select></div>
                        <label for="m-practica-horas">Horas requeridas</label>
                        <div class="input-wrapper"><input id="m-practica-horas" name="horas" type="number" min="1" value="64" required></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn-primary-sm">Crear práctica</button>
                    </div>
                </form>
            </div>
        </div>`;
    } catch (error) {
        sigpaAlert('Nueva práctica', error.message, 'error');
    }
}

async function guardarNuevaPractica(event) {
    event.preventDefault();
    try {
        await enviarDatosAcademicos('/director/nueva_practica', Object.fromEntries(new FormData(event.currentTarget)));
        closeModal();
        loadDirectorView('practicas');
    } catch (error) {
        sigpaAlert('Nueva práctica', error.message, 'warning');
    }
}

function closeModalNuevaPractica(e) {
    if (!e || e.target.id === 'modalNuevaPractica' || (e.target.classList && e.target.classList.contains('btn-close')) || (e.target.classList && e.target.classList.contains('btn-secondary'))) {
        const modal = document.getElementById('modalNuevaPractica');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('formNuevaPractica');
        if (form) form.reset();
    }
}

async function handleGuardarPractica(e) {
    e.preventDefault();
    const nombre = (document.getElementById('m-prac-nombre') ? document.getElementById('m-prac-nombre').value : '').trim();
    const semestre = document.getElementById('m-prac-semestre') ? Number(document.getElementById('m-prac-semestre').value) : 1;
    const tipo = document.getElementById('m-prac-tipo') ? document.getElementById('m-prac-tipo').value : 'OBSERVACION';
    const creditos = document.getElementById('m-prac-creditos') ? Number(document.getElementById('m-prac-creditos').value) : 3;
    const horas = document.getElementById('m-prac-horas') ? Number(document.getElementById('m-prac-horas').value) : 64;
    const cupos = document.getElementById('m-prac-cupos') ? Number(document.getElementById('m-prac-cupos').value) : 20;
    const descripcion = (document.getElementById('m-prac-desc') ? document.getElementById('m-prac-desc').value : '').trim();

    // Client-side validations
    if (!nombre) {
        await sigpaAlert('Campo Obligatorio', 'Por favor ingresa el nombre de la práctica pedagógica.', 'warning');
        return;
    }
    if (isNaN(creditos) || creditos <= 0) {
        await sigpaAlert('Valor Inválido', 'Los créditos deben ser un valor numérico positivo mayor a 0.', 'warning');
        return;
    }
    if (isNaN(horas) || horas <= 0) {
        await sigpaAlert('Valor Inválido', 'Las horas requeridas deben ser un valor numérico positivo mayor a 0.', 'warning');
        return;
    }
    if (isNaN(cupos) || cupos <= 0) {
        await sigpaAlert('Valor Inválido', 'Los cupos deben ser un valor numérico positivo mayor a 0.', 'warning');
        return;
    }

    try {
        const token = getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/director/nueva_practica`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                nombre,
                semestre,
                tipo,
                creditos,
                horas,
                horas_requeridas: horas,
                cupos,
                descripcion
            })
        });
        const d = await res.json();
        if (d.success) {
            closeModalNuevaPractica();
            closeModal();
            await sigpaAlert('Práctica Creada', d.message || 'La nueva práctica ha sido registrada exitosamente en el catálogo institucional.', 'success');
            // Dynamically refresh practice list/table
            loadDirectorView('practicas');
        } else {
            sigpaAlert('Atención', d.message || d.error || 'No fue posible registrar la práctica', 'warning');
        }
    } catch (err) {
        sigpaAlert('Error de Red', err.message, 'error');
    }
}

function openModalNuevaInstitucion() {
    const mc = document.getElementById('modalContainer');
    mc.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3 class="modal-title">🏫 Registrar Institución Receptora</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <form onsubmit="handleGuardarInstitucion(event)">
                <div class="modal-body">
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:5px;">Nombre del Colegio / Institución</label>
                        <div class="input-wrapper"><input type="text" id="m-inst-nombre" required placeholder="ej. Colegio La Salle"></div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:5px;">Dirección</label>
                        <div class="input-wrapper"><input type="text" id="m-inst-dir" required placeholder="ej. Carrera 27 # 10-20"></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:5px;">Teléfono</label>
                            <div class="input-wrapper"><input type="text" id="m-inst-tel" placeholder="ej. 6076300000"></div>
                        </div>
                        <div>
                            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:5px;">Cupos Máximos (2-5)</label>
                            <div class="input-wrapper"><input type="number" id="m-inst-cupos" value="3" min="1" max="5" required></div>
                        </div>
                    </div>
                    <div style="margin-bottom:4px;">
                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:5px;">Vencimiento de Convenio</label>
                        <div class="input-wrapper"><input type="date" id="m-inst-venc" value="2027-12-31" required></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary-sm">✔ Guardar Convenio</button>
                </div>
            </form>
        </div>
    </div>`;
}

async function handleGuardarInstitucion(e) {
    e.preventDefault();
    const payload = {
        nombre:     document.getElementById('m-inst-nombre').value.trim(),
        direccion:  document.getElementById('m-inst-dir').value.trim(),
        telefono:   document.getElementById('m-inst-tel').value.trim(),
        cupos:      document.getElementById('m-inst-cupos').value,
        vencimiento:document.getElementById('m-inst-venc').value,
    };
    try {
        const res = await fetch(`${API_BASE}/director/nueva_institucion`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) { closeModal(); loadDirectorView('instituciones'); }
        else sigpaAlert('Registro Institucional', d.message, 'warning');
    } catch (err) { sigpaAlert('Error de Conexión', err.message, 'error'); }
}

function openModalAsignarEstudiante() {
    document.getElementById('modalContainer').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3 class="modal-title">Asignar Estudiante a Institución</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <form onsubmit="handleGuardarAsignacion(event)">
                <div class="modal-body">
                    <label for="m-asig-sem">Semestre</label>
                    <div class="input-wrapper"><select id="m-asig-sem" name="semestre" required onchange="cargarOpcionesAsignacion(this.form)">${opcionesSemestres()}</select></div>
                    <label for="m-asig-est">Estudiante</label>
                    <div class="input-wrapper"><select id="m-asig-est" name="id_estudiante" required disabled></select></div>
                    <label for="m-asig-inst">Institución receptora</label>
                    <div class="input-wrapper"><select id="m-asig-inst" name="id_institucion" required disabled></select></div>
                    <p class="text-muted" role="status" data-asignacion-estado></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary-sm" disabled>Confirmar asignación</button>
                </div>
            </form>
        </div>
    </div>`;
}

async function cargarOpcionesAsignacion(form) {
    const { semestre, id_estudiante: estudiante, id_institucion: institucion } = form.elements;
    const seleccion = semestre.value;
    const submit = form.querySelector('[type="submit"]');
    const estado = form.querySelector('[data-asignacion-estado]');
    const solicitud = Symbol();
    form.solicitudAsignacion = solicitud;
    estudiante.disabled = institucion.disabled = submit.disabled = true;
    estudiante.innerHTML = institucion.innerHTML = '';
    estado.textContent = seleccion ? 'Cargando opciones…' : '';
    if (!seleccion) return;
    try {
        const [estudiantes, instituciones, practicas] = await Promise.all([
            leerDatosAcademicos(`/director/estudiantes?semestre=${seleccion}`),
            leerDatosAcademicos('/director/instituciones'),
            leerDatosAcademicos('/director/practicas'),
        ]);
        if (form.solicitudAsignacion !== solicitud) return;

        const practicaAbierta = practicas.some(p => p.estado === 'ABIERTA' && p.semestre === Number(seleccion));
        const receptoras = practicaAbierta
            ? instituciones.filter(i => i.vigente && i.estudiantesAsignados < i.cupos)
            : [];
        estudiante.innerHTML = '<option value="">Seleccione un estudiante</option>' + estudiantes.map(e =>
            optionAcademica(e.id, `${e.nombre} (Semestre ${e.semestre})`)
        ).join('');
        institucion.innerHTML = '<option value="">Seleccione una institución</option>' + receptoras.map(i =>
            optionAcademica(i.id, `${i.nombre} (${i.cupos - i.estudiantesAsignados} cupos disponibles)`)
        ).join('');
        estudiante.disabled = !estudiantes.length;
        institucion.disabled = !receptoras.length;
        submit.disabled = estudiante.disabled || institucion.disabled;
        estado.textContent = !practicaAbierta ? 'Este semestre necesita una práctica abierta.' :
            !estudiantes.length ? 'No hay estudiantes activos en este semestre.' :
                !receptoras.length ? 'No hay instituciones con convenio vigente y cupos disponibles.' : '';
    } catch (error) {
        if (form.solicitudAsignacion === solicitud) estado.textContent = error.message;
    }
}

async function handleGuardarAsignacion(event) {
    event.preventDefault();
    try {
        await enviarDatosAcademicos('/director/asignar', Object.fromEntries(new FormData(event.currentTarget)));
        closeModal();
        loadDirectorView('asignaciones');
    } catch (error) {
        sigpaAlert('Asignación', error.message, 'warning');
    }
}

async function resolverAsignacion(id, estado) {
    try {
        await enviarDatosAcademicos('/director/aprobar_asignacion', { id_asignacion: id, estado });
        loadDirectorView('asignaciones');
    } catch (error) {
        sigpaAlert('Asignación', error.message, 'warning');
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   TUTOR MODALS (EVALUACIÓN TRANSPARENTE CON 3 MOMENTOS Y EVIDENCIAS)
   ═══════════════════════════════════════════════════════════════════════ */

let tutorBitacoras = new Map();

function textoBitacora(raw) {
    const data = parseDataPedagogica(raw);
    if (!data || typeof data !== 'object') return raw || '—';
    const lines = [];
    function append(value, label = '') {
        if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, item]) => append(item, Array.isArray(value) ? '' : key));
        } else if (value != null && value !== '') {
            lines.push(label ? `${label}: ${value}` : String(value));
        }
    }
    append(data);
    return lines.join('\n') || '—';
}

function openModalCalificar(idBitacora) {
    const bitacora = tutorBitacoras.get(idBitacora);
    if (!bitacora) return;
    const calificada = bitacora.estado === 'CALIFICADA' || bitacora.nota != null;
    document.getElementById('modalContainer').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 class="modal-title">${calificada ? 'Bitácora' : 'Calificar bitácora'} ${bitacora.visita}</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <form onsubmit="handleGuardarCalificacion(event, ${idBitacora})">
                <div class="modal-body">
                    <p><strong>Practicante:</strong> ${escaparAcademico(bitacora.estudiante)}</p>
                    <p><strong>Horas registradas:</strong> ${bitacora.horas}</p>
                    <details><summary>Actividades y observaciones</summary>
                        <p style="white-space:pre-wrap;">${escaparAcademico(textoBitacora(bitacora.actividades))}</p>
                        <p style="white-space:pre-wrap;">${escaparAcademico(textoBitacora(bitacora.observaciones))}</p>
                    </details>
                    ${calificada ? `
                        <p><strong>Calificación:</strong> ${bitacora.nota ?? '—'}</p>
                        ${bitacora.nota == null ? '' : `<p><strong>Horas validadas:</strong> ${bitacora.nota >= 3 ? bitacora.horas : 0}</p>`}
                        <p style="white-space:pre-wrap;">${escaparAcademico(bitacora.comentarios)}</p>
                    ` : `
                        <label for="m-eval-nota">Calificación (0 a 5)</label>
                        <div class="input-wrapper"><input type="number" id="m-eval-nota" name="nota" min="0" max="5" step="0.1" required></div>
                        <label for="m-eval-comentarios">Retroalimentación</label>
                        <div class="input-wrapper"><textarea id="m-eval-comentarios" name="comentarios" rows="3" required></textarea></div>
                        <p class="text-muted">Las horas se validan a partir de 3,0. La calificación queda definitiva al guardar.</p>
                    `}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="descargarBitacora(${idBitacora})">Descargar PDF</button>
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cerrar</button>
                    ${calificada ? '' : '<button type="submit" class="btn-primary-sm">Guardar calificación</button>'}
                </div>
            </form>
        </div>
    </div>`;
}

async function handleGuardarCalificacion(event, idBitacora) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
        await enviarDatosAcademicos('/tutor/calificar', { ...Object.fromEntries(new FormData(form)), id_bitacora: idBitacora });
        closeModal();
        loadTutorView('bitacoras');
        sigpaToast('Calificación guardada');
    } catch (error) {
        sigpaAlert('Calificación', error.message, 'warning');
    } finally {
        button.disabled = false;
    }
}

function descargarPdfAcademico(titulo, nombreArchivo, secciones) {
    try {
        if (!window.jspdf?.jsPDF) {
            const vista = window.open('', '_blank');
            if (!vista) throw new Error('Permita abrir la vista de impresión para guardar el PDF');
            vista.opener = null;
            vista.document.write(`<!doctype html><html lang="es"><meta charset="utf-8">
                <title>${escaparAcademico(nombreArchivo.replace(/\.pdf$/, ''))}</title>
                <style>body{font:12pt Arial,sans-serif;margin:2rem}h2{break-after:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}</style>
                <h1>${escaparAcademico(titulo)}</h1>
                ${secciones.map(([label, content]) => `<h2>${escaparAcademico(label)}</h2><p>${escaparAcademico(content)}</p>`).join('')}
                </html>`);
            vista.document.close();
            vista.focus();
            vista.print();
            return;
        }
        const pdf = new window.jspdf.jsPDF();
        const margin = 16;
        const pageWidth = pdf.internal.pageSize.getWidth() - 2 * margin;
        const bottom = pdf.internal.pageSize.getHeight() - margin;
        let y = margin + 4;
        const write = (text, size, style) => {
            pdf.setFont('helvetica', style);
            pdf.setFontSize(size);
            const step = size * 0.45;
            for (const line of pdf.splitTextToSize(String(text), pageWidth)) {
                if (y > bottom) {
                    pdf.addPage();
                    y = margin + 4;
                }
                pdf.text(line, margin, y);
                y += step;
            }
        };
        write(titulo, 17, 'bold');
        for (const [label, content] of secciones) {
            y += 4;
            if (y + 12 > bottom) {
                pdf.addPage();
                y = margin + 4;
            }
            write(label, 12, 'bold');
            write(content, 10, 'normal');
        }
        pdf.save(nombreArchivo);
    } catch (error) {
        sigpaAlert('Descargar PDF', error.message, 'error');
    }
}

function descargarBitacora(id) {
    const b = tutorBitacoras.get(id);
    if (!b) return;
    descargarPdfAcademico(`Bitácora ${b.visita}`, `bitacora-${b.id}.pdf`, [
        ['Datos', [b.estudiante, b.practica, b.institucion, b.fecha, `Horas registradas: ${b.horas}`].filter(Boolean).join('\n')],
        ['Actividades', textoBitacora(b.actividades)],
        ['Observaciones', textoBitacora(b.observaciones)],
        ['Soporte adjunto', b.evidencia || '—'],
        ['Evaluación', b.nota == null ? 'Pendiente' : `${b.nota}/5
${b.comentarios}`],
    ]);
}

function seccionesInformePractica(practica, asignaciones, instituciones) {
    const participantes = asignaciones.filter(a => a.semestre === practica.semestre);
    const aprobadas = participantes.filter(a => a.aprobacion === 'APROBADA');
    const pendientesAprobacion = participantes.filter(a => a.aprobacion === 'PENDIENTE');
    const porEstudiante = new Map();
    const porInstitucion = new Map();

    for (const asignacion of aprobadas) {
        const actual = porEstudiante.get(asignacion.idEstudiante);
        if (!actual || (actual.estado !== 'EN_CURSO' && asignacion.estado === 'EN_CURSO')) {
            porEstudiante.set(asignacion.idEstudiante, asignacion);
        }
        if (!porInstitucion.has(asignacion.idInstitucion)) porInstitucion.set(asignacion.idInstitucion, new Set());
        porInstitucion.get(asignacion.idInstitucion).add(asignacion.idEstudiante);
    }

    const pendientesHoras = [...porEstudiante.values()].filter(a => a.horasAcumuladas < (a.horasRequeridas || practica.horas));
    const resumen = [
        `Semestre ${practica.semestre} · Horas requeridas: ${practica.horas}`,
        `Estudiantes con asignación aprobada: ${porEstudiante.size}`,
        `Estudiantes con horas pendientes: ${pendientesHoras.length}`,
        `Estudiantes con horas completas: ${porEstudiante.size - pendientesHoras.length}`,
        `Asignaciones pendientes de aprobación: ${pendientesAprobacion.length}`,
    ];
    const institucionesResumen = instituciones.map(institucion => {
        const asignados = porInstitucion.get(institucion.id)?.size || 0;
        const libres = Math.max(0, institucion.cupos - institucion.estudiantesAsignados);
        const disponibilidad = institucion.vigente ? `${libres} disponibles` : 'sin convenio vigente';
        return `${institucion.nombre} · ${asignados} estudiantes aprobados del semestre · ${institucion.estudiantesAsignados}/${institucion.cupos} cupos ocupados o reservados · ${disponibilidad}`;
    });
    const sinInstitucion = porInstitucion.get(null)?.size || 0;
    if (sinInstitucion) institucionesResumen.push(`Sin institución registrada · ${sinInstitucion} estudiantes aprobados del semestre`);

    return [
        ['Resumen administrativo', resumen.join('\n')],
        ['Estudiantes e inventario de cupos por institución', institucionesResumen.join('\n') || 'Sin instituciones registradas.'],
        ['Detalle de horas pendientes', pendientesHoras.map(a => {
            const requeridas = a.horasRequeridas || practica.horas;
            return `${a.estudiante} · ${a.institucion || 'Sin institución'} · ${a.horasAcumuladas}/${requeridas} h · Faltan ${requeridas - a.horasAcumuladas} h`;
        }).join('\n') || 'Sin estudiantes con horas pendientes.'],
    ];
}

async function mostrarInformePractica(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const semestre = Number(form.elements.practica.value);
    const result = document.getElementById('resultadoInformePractica');
    const request = Symbol();
    result.solicitudInforme = request;
    result.innerHTML = loadingState();
    try {
        const [practicas, asignaciones, instituciones] = await Promise.all([
            leerDatosAcademicos('/director/practicas'),
            leerDatosAcademicos('/director/asignaciones'),
            leerDatosAcademicos('/director/instituciones'),
        ]);
        if (result.solicitudInforme !== request) return;
        const practica = practicas.find(p => p.semestre === semestre && p.estado === 'ABIERTA');
        if (!practica) throw new Error('La práctica seleccionada ya no está disponible');
        const secciones = seccionesInformePractica(practica, asignaciones, instituciones);
        result.innerHTML = `
            <h4>${escaparAcademico(practica.nombre)}</h4>
            ${secciones.map(([label, content]) => `<h5>${label}</h5><p style="white-space:pre-wrap;">${escaparAcademico(content)}</p>`).join('')}
            <button type="button" class="btn-primary-sm" data-descargar>Descargar informe</button>`;
        result.querySelector('[data-descargar]').addEventListener('click', () =>
            descargarPdfAcademico(`Informe de ${practica.nombre}`, `informe-practica-${practica.id}.pdf`, secciones)
        );
    } catch (error) {
        if (result.solicitudInforme === request) result.innerHTML = errorState(escaparAcademico(error.message));
    }
}

function limpiarInformePractica() {
    const result = document.getElementById('resultadoInformePractica');
    result.solicitudInforme = null;
    result.replaceChildren();
}

async function mostrarNotificacionesAcademicas(rol) {
    try {
        if (rol === 'DIRECTOR') {
            const items = await leerDatosAcademicos('/director/asignaciones');
            const pendientes = items.filter(a => a.aprobacion === 'PENDIENTE').length;
            await sigpaAlert('Notificaciones', pendientes ? `Asignaciones pendientes de aprobación: ${pendientes}.` : 'No hay asignaciones pendientes.', 'info');
        } else {
            const items = await leerDatosAcademicos('/tutor/bitacoras');
            const pendientes = items.filter(b => b.estado !== 'CALIFICADA' && b.nota == null).length;
            await sigpaAlert('Notificaciones', pendientes ? `Bitácoras pendientes de calificación: ${pendientes}.` : 'No hay bitácoras pendientes.', 'info');
        }
    } catch (error) {
        sigpaAlert('Notificaciones', error.message, 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   ASESOR MODALS (AVAL IN SITU TRANSPARENTE CON 3 MOMENTOS Y EVIDENCIAS)
   ═══════════════════════════════════════════════════════════════════════ */

function openModalAsesorEval(idBitacora, estudiante, visita) {
    const user = getCurrentUser();
    const bit = (window._currentAsesorBitacoras || []).find(b => b.id === Number(idBitacora)) || {};
    const evidenciaUrl = resolveEvidenceUrl(bit.evidencia);

    document.getElementById('modalContainer').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 class="modal-title">✅ Aval In Situ — Visita ${visita}</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <form onsubmit="handleGuardarAsesorEval(event, ${idBitacora}, ${user.id})">
                <div class="modal-body">
                    <!-- Resumen del practicante e institución -->
                    <div class="alert-box alert-info" style="margin-bottom:16px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:gap:8px;">
                            <div>
                                <strong>Practicante:</strong> ${estudiante || bit.estudiante || 'Estudiante'} &nbsp;|&nbsp;
                                <strong>Institución:</strong> ${bit.institucion || 'Colegio Sede'}
                            </div>
                            <div>
                                <span class="badge" style="background:var(--success,#10b981);color:white;padding:3px 8px;border-radius:4px;font-size:11.5px;font-weight:700;">
                                    ⏱️ ${bit.horas || 0} Horas en Aula
                                </span>
                                ${bit.fecha ? `&nbsp;<span class="text-muted" style="font-size:11.5px;">📅 ${bit.fecha}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Desglose Pedagógico Transparente -->
                    <div style="margin-bottom:16px;background:var(--bg-main,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:14px;">
                        <h4 style="font-size:13px;font-weight:800;color:var(--text-main);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                            <span>📝</span> Actividades y Momentos Pedagógicos Diligenciados
                        </h4>
                        ${renderMomentoPedagogicoHTML(bit.actividades, bit.observaciones)}
                    </div>

                    <!-- Enlace directo a Evidencia -->
                    <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;">
                        <span style="font-size:12.5px;color:#166534;font-weight:600;display:flex;align-items:center;gap:6px;">
                            <span>📁</span> Soporte de Evidencia Digital:
                        </span>
                        ${evidenciaUrl ? `
                            <a href="${evidenciaUrl}" target="_blank" rel="noopener noreferrer"
                               class="btn-primary-sm" style="font-size:12px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                               📎 Ver Archivo Adjunto (${bit.evidencia && bit.evidencia.length > 30 ? bit.evidencia.substring(0, 30) + '...' : (bit.evidencia || 'Evidencia')}) ↗
                            </a>
                        ` : `
                            <span class="text-muted" style="font-size:12px;font-style:italic;">No se adjuntó archivo de evidencia</span>
                        `}
                    </div>

                    <div style="margin-bottom:4px;">
                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:5px;">Observación del Desempeño In Situ y Aval de Cumplimiento *</label>
                        <div class="input-wrapper">
                            <textarea id="m-asesor-comentarios" rows="4" required
                                placeholder="Consigna la puntualidad, trato afectuoso con los niños, apoyo a la docente titular, dominio de grupo y aspectos formativos destacados...">${bit.comentarios || ''}</textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary-sm">✔ Registrar Aval In Situ</button>
                </div>
            </form>
        </div>
    </div>`;
}

async function handleGuardarAsesorEval(e, idBitacora, idEvaluador) {
    e.preventDefault();
    const comentarios = document.getElementById('m-asesor-comentarios').value.trim();
    try {
        const res = await fetch(`${API_BASE}/asesor/evaluar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_bitacora: idBitacora, id_evaluador: idEvaluador, nota: 5.0, comentarios })
        });
        const d = await res.json();
        if (d.success) {
            closeModal();
            await sigpaAlert('Aval In Situ Registrado', 'El aval presencial ha sido registrado y computado exitosamente.', 'success');
            loadAsesorView('estudiantes');
        } else {
            sigpaAlert('Atención', d.message, 'warning');
        }
    } catch (err) { sigpaAlert('Error de Conexión', err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   INTEGRACIÓN DE REPORTES PDF (MICROSERVICIO & GATEWAY)
   ═══════════════════════════════════════════════════════════════════════ */

async function descargarReporteVisita(datos) {
    try {
        await sigpaAlert('Generando Informe', 'Compilando informe de visita en formato PDF institucional...', 'info');

        const payload = {
            id_bitacora: datos.idBitacora || datos.id || 1,
            visita: datos.visita || 1,
            estudiante: datos.estudiante || 'Estudiante UDI',
            tutor: datos.tutor || 'Tutor UDI',
            institucion: datos.institucion || 'Institución Educativa',
            fecha_visita: datos.fecha || new Date().toISOString().split('T')[0],
            evaluacion: {
                nota: datos.nota != null ? Number(datos.nota) : 5.0,
                comentarios: datos.comentarios || 'Evaluación pedagógica satisfactoria'
            }
        };

        const endpoints = [
            'http://localhost:3000/api/v1/reports/visita-pdf',
            'http://localhost:5001/api/v1/reports/visita-pdf',
            `${API_BASE.replace('/api', '')}/api/v1/reports/visita-pdf`,
            `${API_BASE}/v1/reports/visita-pdf`
        ];

        let blob = null;
        let filename = `informe-visita-${payload.visita}-${Date.now()}.pdf`;

        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf, application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        for (const ep of endpoints) {
            try {
                const res = await fetch(ep, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const contentType = res.headers.get('content-type') || '';
                    if (contentType.includes('application/pdf')) {
                        blob = await res.blob();
                        const cd = res.headers.get('content-disposition');
                        if (cd && cd.includes('filename=')) {
                            const match = cd.match(/filename="?([^";]+)"?/);
                            if (match && match[1]) filename = match[1];
                        }
                        break;
                    } else {
                        const json = await res.json();
                        if (json.reportUrl || json.url) {
                            window.open(json.reportUrl || json.url, '_blank');
                            await sigpaAlert('Informe Generado', 'El informe PDF ha sido generado y abierto en una nueva pestaña.', 'success');
                            return;
                        }
                    }
                }
            } catch (errEp) {
                // Siguiente endpoint
            }
        }

        if (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 1000);
            await sigpaAlert('Descarga Completa', `El informe (${filename}) ha sido descargado correctamente.`, 'success');
        } else {
            await sigpaAlert('Aviso', 'No se pudo conectar con el microservicio de reportes para generar el PDF binario. Verifique que el servicio esté activo.', 'warning');
        }
    } catch (err) {
        sigpaAlert('Error de Descarga', err.message, 'error');
    }
}

async function descargarActaCierre(datos) {
    try {
        await sigpaAlert('Generando Acta', 'Validando prerrequisitos y emitiendo Acta de Cierre en PDF...', 'info');

        const payload = {
            id_asignacion: datos.idAsignacion || datos.id || 1,
            estudiante: datos.estudiante || 'Estudiante UDI',
            tutor: datos.tutor || 'Tutor UDI',
            institucion: datos.institucion || 'Institución Educativa',
            horas_cumplidas: datos.horasAcumuladas || datos.horas_cumplidas || 64,
            total_horas_requeridas: datos.horasRequeridas || datos.horas_requeridas || 64,
            bitacoras_pendientes: datos.bitacoras_pendientes || 0,
            nota_final: datos.nota_final || 5.0,
            fecha_cierre: new Date().toISOString().split('T')[0]
        };

        const endpoints = [
            'http://localhost:3000/api/v1/reports/acta-cierre-pdf',
            'http://localhost:5001/api/v1/reports/acta-cierre-pdf',
            `${API_BASE.replace('/api', '')}/api/v1/reports/acta-cierre-pdf`,
            `${API_BASE}/v1/reports/acta-cierre-pdf`
        ];

        let blob = null;
        let filename = `acta-cierre-${payload.id_asignacion}.pdf`;

        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf, application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        for (const ep of endpoints) {
            try {
                const res = await fetch(ep, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const contentType = res.headers.get('content-type') || '';
                    if (contentType.includes('application/pdf')) {
                        blob = await res.blob();
                        const cd = res.headers.get('content-disposition');
                        if (cd && cd.includes('filename=')) {
                            const match = cd.match(/filename="?([^";]+)"?/);
                            if (match && match[1]) filename = match[1];
                        }
                        break;
                    } else {
                        const json = await res.json();
                        if (json.reportUrl || json.url) {
                            window.open(json.reportUrl || json.url, '_blank');
                            await sigpaAlert('Acta Emitida', 'El Acta Final de Cierre ha sido generada y abierta.', 'success');
                            return;
                        }
                    }
                } else if (res.status === 400) {
                    const errJson = await res.json();
                    await sigpaAlert('Requisito No Cumplido', errJson.error || errJson.message || 'No se cumplen los prerrequisitos para el Acta de Cierre', 'warning');
                    return;
                }
            } catch (errEp) {
                // Siguiente endpoint
            }
        }

        if (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 1000);
            await sigpaAlert('Descarga Completa', `El Acta de Cierre (${filename}) ha sido descargada exitosamente.`, 'success');
        } else {
            await sigpaAlert('Aviso', 'No se pudo generar el Acta de Cierre en PDF. Verifique la conexión con el microservicio de reportes.', 'warning');
        }
    } catch (err) {
        sigpaAlert('Error de Descarga', err.message, 'error');
    }
}

function abrirModalReportes(rol) {
    const user = getCurrentUser();
    const mc = document.getElementById('modalContainer');
    mc.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 520px;">
            <div class="modal-header">
                <h3 class="modal-title">📑 Exportación de Informes y Actas Institucionales</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
                    Generación autónoma y descentralizada de documentos oficiales en formato PDF bajo los estándares de acreditación UDI.
                </p>

                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong style="font-size:13.5px;color:var(--text-main);display:block;">📄 Informe Formal de Visita (CU-13)</strong>
                            <small class="text-muted">Informe pedagógico con rúbrica, asistencia y conceptos.</small>
                        </div>
                        <button type="button" class="btn-primary-sm" onclick="descargarReporteVisita({ visita: 1, estudiante: 'Estudiante Practicante', tutor: '${(user.nombre || 'Tutor UDI').replace(/'/g, "\\'")}', institucion: 'Colegio Piloto UDI' })">
                            📥 Descargar
                        </button>
                    </div>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong style="font-size:13.5px;color:var(--text-main);display:block;">🎓 Acta Final de Cierre (CU-14 / CU-15)</strong>
                            <small class="text-muted">Certificación de 100% de horas cumplidas y nota consolidada.</small>
                        </div>
                        <button type="button" class="btn-primary-sm" onclick="descargarActaCierre({ idAsignacion: 1, estudiante: 'Estudiante Practicante', tutor: '${(user.nombre || 'Tutor UDI').replace(/'/g, "\\'")}', institucion: 'Colegio Piloto UDI', horasAcumuladas: 64, horasRequeridas: 64, nota_final: 4.8 })">
                            📥 Descargar
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cerrar</button>
            </div>
        </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   ESTUDIANTE — Guardar Bitácora
   ═══════════════════════════════════════════════════════════════════════ */

async function handleGuardarBitacora(e, idAsignacion) {
    e.preventDefault();
    const fechaEl = document.getElementById('b-fecha');
    const fechaVal = fechaEl ? fechaEl.value : '';
    if (fechaVal) {
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999);
        const fechaSesion = new Date(fechaVal + 'T00:00:00');
        if (fechaSesion > hoy) {
            sigpaAlert('Fecha No Válida', 'La fecha de la sesión no puede ser futura.', 'warning');
            return;
        }
    }
    const horasNum = parseFloat(document.getElementById('b-horas').value);
    if (isNaN(horasNum) || horasNum <= 0) {
        sigpaAlert('Horas Requeridas', 'Ingresa una cantidad de horas válida (mínimo 1 hora).', 'warning');
        return;
    }
    if (horasNum > 8) {
        sigpaAlert('Límite de Horas Excedido', 'El reglamento institucional prohíbe registrar más de 8 horas en una sola jornada pedagógica.', 'warning');
        return;
    }
    const payload = {
        id_asignacion: idAsignacion,
        visita:        document.getElementById('b-visita').value,
        fecha:         fechaVal || undefined,
        horas:         horasNum,
        actividades:   document.getElementById('b-actividades').value.trim(),
        observaciones: document.getElementById('b-observaciones').value.trim(),
        evidencia:     document.getElementById('b-evidencia').value.trim(),
    };
    try {
        const res = await fetch(`${API_BASE}/estudiante/bitacora`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) {
            await sigpaAlert('¡Bitácora Registrada!', '¡Bitácora registrada con éxito! Tu tutor recibirá una notificación.', 'success');
            loadEstudianteView('resumen');
        } else {
            sigpaAlert('Atención', d.message, 'warning');
        }
    } catch (err) { sigpaAlert('Error de Conexión', err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL SHARED
   ═══════════════════════════════════════════════════════════════════════ */

function closeModal(e) {
    if (!e || e.target.classList.contains('modal-overlay') || e.target.classList.contains('btn-close')) {
        document.getElementById('modalContainer').innerHTML = '';
    }
}
