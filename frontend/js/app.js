
            
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
            ${navLabel('AUDITORÍA Y REPORTES')}
            ${navItem('📈', 'Auditoría en Tiempo Real', "loadDirectorView('auditoria', event.currentTarget)")}
            ${navItem('📑', 'Exportar Informes y Actas', "loadDirectorView('informes', event.currentTarget)")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        setTopbarCTA('➕', 'Nueva Práctica', "openModalNuevaPractica()");
        loadDirectorView('kpis');

    } else if (rol === 'ESTUDIANTE') {
        nav.innerHTML = `
            ${navLabel('MI FORMACIÓN PRÁCTICA')}
            ${navItem('📊', 'Mi Práctica',                 "loadEstudianteView('resumen', event.currentTarget)")}
            ${navItem('✍️',  'Bitácora y Plan',             "loadEstudianteView('bitacora', event.currentTarget)")}
            ${navItem('⭐', 'Seguimiento & Calificaciones', "loadEstudianteView('evaluaciones', event.currentTarget)")}
            ${navItem('📱', 'Asistencia Presencial (QR)', "abrirModalQrEstudiante()")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        setTopbarCTA('✍️', 'Nueva Bitácora', "loadEstudianteView('bitacora')");
        loadEstudianteView('resumen');

    } else if (rol === 'TUTOR' || rol === 'COORDINADOR') {
        nav.innerHTML = `
            ${navLabel('SEGUIMIENTO')}
            ${navItem('📝', 'Bitácoras',  "loadTutorView('bitacoras', event.currentTarget)")}
            ${navItem('👥', 'Mis Practicantes',       "loadTutorView('estudiantes', event.currentTarget)")}
        `;
        setActive(nav.querySelectorAll('.nav-item')[0]);
        setTopbarCTA('📅', 'Agendar Visita de Supervisión', "sigpaAlert('Agenda de Visitas', 'El módulo de agendamiento de visitas de supervisión se encuentra en fase de despliegue.', 'info')");
        loadTutorView('bitacoras');

    } else if (rol === 'ASESOR') {
        nav.innerHTML = `
            ${navLabel('IN SITU')}
            ${navItem('🏫', 'Practicantes en Aula',   "loadAsesorView('estudiantes', event.currentTarget)")}
            ${navItem('🔍', 'Sesiones por Avalar',    "loadAsesorView('bitacoras', event.currentTarget)")}
            ${navItem('📷', 'Escanear Asistencia QR', "abrirModalEscanerAsesor()")}
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
                                    <td><strong style="font-size:13px;">${escaparAcademico(p.nombre)}</strong><br>
                                        <small class="text-muted">${escaparAcademico(p.institucion || p.tipo)}</small></td>
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
                            <th>Semestre</th><th>Nombre de la Práctica</th><th>Modalidad</th>
                            <th>Tutor Docente</th><th>Horas</th><th>Practicantes</th><th>Estado</th><th>Acciones</th>
                        </tr></thead>
                        <tbody>
                            ${practicas.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:28px;color:#94a3b8;">No hay prácticas pedagógicas registradas aún.</td></tr>` : ''}
                            ${practicas.map(p => `
                            <tr>
                                <td><span class="status-badge status-brand">Sem ${p.semestre}</span></td>
                                <td><strong>${escaparAcademico(p.nombre)}</strong></td>
                                <td><span class="status-badge ${p.tipo === 'OBSERVACION' ? 'status-graded' : 'status-open'}">${escaparAcademico(p.tipo)}</span></td>
                                <td>
                                    ${p.tutor ? `<span style="font-weight:600;color:#0f172a;">👨‍🏫 ${escaparAcademico(p.tutor)}</span>` : '<span class="text-muted">Sin tutor asignado</span>'}
                                    <br>
                                    <button class="btn-secondary-sm" style="font-size:11px;padding:2px 8px;margin-top:4px;"
                                        onclick="openModalAsignarTutorPractica(${p.id}, '${escaparAcademico(p.nombre)}', ${p.idTutor || 'null'})">
                                        ✏️ ${p.tutor ? 'Cambiar Tutor' : 'Asignar Tutor'}
                                    </button>
                                </td>
                                <td>${p.horas} hrs</td>
                                <td><strong>${p.totalEstudiantes}</strong></td>
                                <td><span class="status-badge ${p.estado === 'ABIERTA' ? 'status-open' : 'status-closed'}">${p.estado}</span></td>
                                <td>
                                    <div style="display:flex;gap:6px;align-items:center;">
                                        <button class="btn-${p.estado === 'ABIERTA' ? 'warning' : 'success'}-sm"
                                            onclick="cambiarEstadoPractica(${p.id}, '${p.estado === 'ABIERTA' ? 'CERRADA' : 'ABIERTA'}')">
                                            ${p.estado === 'ABIERTA' ? 'Cerrar' : 'Abrir'}
                                        </button>
                                        <button class="btn-danger-sm" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"
                                            title="Eliminar práctica"
                                            onclick="confirmarEliminarPractica(${p.id}, '${escaparAcademico(p.nombre)}', ${p.totalEstudiantes || 0})">
                                            🗑️
                                        </button>
                                    </div>
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
                            <th>Cupos Ocupados</th><th>Vencimiento</th><th>Acciones</th>
                        </tr></thead>
                        <tbody>
                            ${insts.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:28px;color:#94a3b8;">No hay instituciones registradas aún.</td></tr>` : ''}
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
                                    <td>
                                        <button class="btn-danger-sm" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"
                                            title="Eliminar institución"
                                            onclick="confirmarEliminarInstitucion(${i.id}, '${escaparAcademico(i.nombre)}', ${i.estudiantesAsignados || 0})">
                                            🗑️ Eliminar
                                        </button>
                                    </td>
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

    } else if (tab === 'informes' || tab === 'auditoria') {
        await renderAuditoriaDirector(tab === 'auditoria' ? 'cupos' : 'practicas');
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
   ██████████  VISTA: ESTUDIANTE (ESPACIO DE PRÁCTICA PEDAGÓGICA)  ██████████
   ═══════════════════════════════════════════════════════════════════════ */

let _bitacoraDraftTimer = null;
let _archivoPlanCargado = null;       // { filename, base64 }
let _archivoEvidenciaCargado = null;  // { filename, base64 }
let _estudianteBitacorasCache = [];

async function loadEstudianteView(tab, btn) {
    if (btn) setActive(btn);
    const main = document.getElementById('mainView');
    const user = getCurrentUser();
    pageTitle('SIGPA — Mi Práctica Pedagógica', 'Registro de bitácoras, planes de clase y evidencias');

    /* ═══════════════════════════════════════════════════════════════════
       1. VISTA: MI PRÁCTICA & PROGRESO DE HORAS
       ═══════════════════════════════════════════════════════════════════ */
    if (!tab || tab === 'resumen' || tab === 'kpis') {
        main.innerHTML = loadingState();
        try {
            const [asigRes, progRes, bitRes] = await Promise.all([
                fetch(`${API_BASE}/estudiante/asignacion?id_estudiante=${user.id}`).then(r => r.json()),
                fetch(`${API_BASE}/estudiante/progreso?id_estudiante=${user.id}`).then(r => r.json()),
                fetch(`${API_BASE}/estudiante/bitacoras?id_estudiante=${user.id}`).then(r => r.json())
            ]);

            const data = asigRes.data;
            if (!data) {
                main.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-title">Sin práctica asignada</div>
                    <p class="empty-state-desc">Aún no tienes una práctica asignada por la Dirección de Programa. Contacta a tu coordinador académico.</p>
                </div>`;
                return;
            }

            const bitacoras = bitRes.data || [];
            _estudianteBitacorasCache = bitacoras;

            const calificadas = bitacoras.filter(b => b.nota != null || b.estado === 'CALIFICADA' || b.estado === 'APROBADA');
            const pendientes = bitacoras.filter(b => b.estado === 'PENDIENTE');

            const horasAprobadas = calificadas.reduce((sum, b) => sum + Number(b.horas || 0), 0);
            const horasPendientes = pendientes.reduce((sum, b) => sum + Number(b.horas || 0), 0);
            const horasValidadas = Math.max(horasAprobadas, Number(data.horasAcumuladas || 0));
            const metaHoras = Number(data.horasRequeridas || 64);
            const pctAprobado = metaHoras > 0 ? Math.min(100, Math.round((horasValidadas / metaHoras) * 100)) : 0;
            const pctPendiente = metaHoras > 0 ? Math.min(100 - pctAprobado, Math.round((horasPendientes / metaHoras) * 100)) : 0;
            const horasFaltantes = Math.max(0, metaHoras - horasValidadas);

            const notasProm = calificadas.length > 0
                ? (calificadas.reduce((s, b) => s + parseFloat(b.nota != null ? b.nota : 5.0), 0) / calificadas.length).toFixed(1)
                : '—';

            main.innerHTML = `
            <!-- Tarjeta Principal de Práctica (Hero) -->
            <div class="student-hero-card">
                <div class="student-hero-info">
                    <span class="student-hero-tag">🏫 Semestre ${data.semestre || '—'} · ${data.tipo || 'Práctica Pedagógica'}</span>
                    <h2 class="student-hero-title">${data.practica || 'Práctica Formativa'}</h2>
                    <div class="student-hero-meta">
                        <div class="student-hero-meta-item">📍 <strong>Institución:</strong> ${data.institucion || 'Colegio Sede'}</div>
                        <div class="student-hero-meta-item">👩‍🏫 <strong>Tutor Académico:</strong> ${data.tutor || 'Docente UDI'}</div>
                        <div class="student-hero-meta-item">📋 <strong>Modalidad:</strong> ${data.tipo || 'Presencial Aula'}</div>
                    </div>
                </div>
                <div>
                    <button class="btn-primary-sm" style="padding:10px 18px;font-size:13.5px;" onclick="loadEstudianteView('bitacora')">
                        ✍️ Registrar Nueva Bitácora
                    </button>
                </div>
            </div>

            <!-- Tarjeta de Progreso Lineal de Horas -->
            <div class="student-progress-card">
                <div class="student-progress-header">
                    <div>
                        <span class="student-progress-title">Cumplimiento de Horas de Práctica</span>
                        <div class="text-muted" style="font-size:12px;margin-top:2px;">Meta curricular obligatoria para el semestre</div>
                    </div>
                    <div>
                        <span class="student-progress-numbers">${horasValidadas}</span>
                        <span class="student-progress-total">/ ${metaHoras} hrs (${pctAprobado}%)</span>
                    </div>
                </div>

                <div class="student-segmented-bar" title="Progreso de Horas">
                    <div class="segment-fill-approved" style="width: ${pctAprobado}%;" title="${horasValidadas} hrs aprobadas"></div>
                    <div class="segment-fill-pending" style="width: ${pctPendiente}%;" title="${horasPendientes} hrs en revisión"></div>
                </div>

                <div class="student-progress-legend">
                    <span class="legend-chip"><span class="legend-dot-circle dot-approved"></span> <strong>${horasValidadas}h</strong> Aprobadas</span>
                    <span class="legend-chip"><span class="legend-dot-circle dot-pending"></span> <strong>${horasPendientes}h</strong> En Revisión</span>
                    <span class="legend-chip"><span class="legend-dot-circle dot-remaining"></span> <strong>${horasFaltantes}h</strong> Faltantes</span>
                </div>
            </div>

            <!-- Grid de Métricas Limpias -->
            <div class="student-stats-grid">
                <div class="student-stat-card">
                    <span class="student-stat-icon">⏱️</span>
                    <div class="student-stat-label">Horas Aprobadas</div>
                    <div class="student-stat-value" style="color:var(--success, #10b981);">${horasValidadas} <small style="font-size:13px;font-weight:500;">hrs</small></div>
                    <div class="student-stat-sub">${horasFaltantes > 0 ? `${horasFaltantes} hrs por cumplir` : '¡100% de horas cumplidas!'}</div>
                </div>
                <div class="student-stat-card">
                    <span class="student-stat-icon">⏳</span>
                    <div class="student-stat-label">Horas en Revisión</div>
                    <div class="student-stat-value" style="color:var(--warning, #f59e0b);">${horasPendientes} <small style="font-size:13px;font-weight:500;">hrs</small></div>
                    <div class="student-stat-sub">${pendientes.length} ${pendientes.length === 1 ? 'bitácora en espera' : 'bitácoras en espera'}</div>
                </div>
                <div class="student-stat-card">
                    <span class="student-stat-icon">📝</span>
                    <div class="student-stat-label">Sesiones Registradas</div>
                    <div class="student-stat-value" style="color:var(--accent, #4f46e5);">${bitacoras.length}</div>
                    <div class="student-stat-sub">${calificadas.length} evaluadas con calificación</div>
                </div>
                <div class="student-stat-card">
                    <span class="student-stat-icon">⭐</span>
                    <div class="student-stat-label">Promedio Académico</div>
                    <div class="student-stat-value">${notasProm !== '—' ? `${notasProm}` : '—'}<small style="font-size:13px;font-weight:500;">${notasProm !== '—' ? '/5.0' : ''}</small></div>
                    <div class="student-stat-sub">${calificadas.length > 0 ? 'Evaluación continua' : 'Sin notas registradas aún'}</div>
                </div>
            </div>

            <!-- Tabla Consolidada de Historial de Bitácoras -->
            <div class="table-card">
                <div class="table-card-header">
                    <div>
                        <span class="table-card-title">Historial de Bitácoras de Práctica</span>
                        <div class="text-muted" style="font-size:12px;margin-top:2px;">Registro secuencial de jornadas de aula, planes de clase y evidencias</div>
                    </div>
                    <div class="table-card-actions">
                        <button class="btn-primary-sm" onclick="loadEstudianteView('bitacora')">✍️ Nueva Bitácora</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr>
                            <th>Sesión</th>
                            <th>Fecha</th>
                            <th>Horas</th>
                            <th>Plan de Clase</th>
                            <th>Evidencia</th>
                            <th>Estado</th>
                            <th>Calificación</th>
                            <th style="text-align:center;">Acción</th>
                        </tr></thead>
                        <tbody>
                            ${bitacoras.length === 0 ? `
                                <tr>
                                    <td colspan="8" style="text-align:center;padding:36px;color:#94a3b8;">
                                        <div style="font-size:32px;margin-bottom:8px;">📝</div>
                                        <div style="font-size:14px;font-weight:600;color:#475569;">Aún no has registrado bitácoras de práctica</div>
                                        <p style="font-size:12.5px;margin-top:4px;">Haz clic en "Nueva Bitácora" para registrar tu primera jornada pedagógica.</p>
                                        <button class="btn-primary-sm" style="margin-top:10px;" onclick="loadEstudianteView('bitacora')">✍️ Registrar Primera Sesión</button>
                                    </td>
                                </tr>
                            ` : bitacoras.map((b, idx) => {
                                const numSesion = b.visita || (idx + 1);
                                const planDoc = b.planClase || '';
                                const evidDoc = b.evidencia || '';
                                const isAprobada = b.estado === 'CALIFICADA' || b.estado === 'APROBADA';
                                return `
                                <tr>
                                    <td>
                                        <strong>Sesión ${numSesion}</strong>
                                    </td>
                                    <td>${b.fecha || '—'}</td>
                                    <td><strong>${b.horas}</strong> hrs</td>
                                    <td>
                                        ${planDoc ? `
                                            <a href="${resolveEvidenceUrl(planDoc)}" target="_blank" rel="noopener noreferrer"
                                               class="btn-secondary" style="padding:3px 8px;font-size:11.5px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                                                📄 Ver Plan
                                            </a>
                                        ` : `<span class="text-muted" style="font-size:11.5px;">No adjuntado</span>`}
                                    </td>
                                    <td>
                                        ${evidDoc ? `
                                            <a href="${resolveEvidenceUrl(evidDoc)}" target="_blank" rel="noopener noreferrer"
                                               class="btn-secondary" style="padding:3px 8px;font-size:11.5px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                                                📎 Evidencia
                                            </a>
                                        ` : `<span class="text-muted" style="font-size:11.5px;">No adjuntada</span>`}
                                    </td>
                                    <td>
                                        <span class="status-badge ${isAprobada ? 'status-open' : b.estado === 'RECHAZADA' ? 'status-rejected' : 'status-pending'}">
                                            ${isAprobada ? 'Aprobada' : b.estado === 'RECHAZADA' ? 'Rechazada' : 'En Revisión'}
                                        </span>
                                    </td>
                                    <td>
                                        ${b.nota ? `<strong style="color:var(--success, #10b981);font-size:13.5px;">${b.nota}/5.0</strong>` : `<span class="text-muted" style="font-size:12px;">Pendiente</span>`}
                                    </td>
                                    <td style="text-align:center;">
                                        <button class="btn-secondary" style="padding:4px 8px;font-size:11.5px;"
                                            onclick="abrirModalDetalleBitacora(${idx})">👁️ Ver Detalle</button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

        } catch (e) {
            main.innerHTML = errorState('Error al cargar tu práctica: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       2. VISTA: REGISTRO DE BITÁCORA Y PLAN DE CLASE (FORMULARIO ÁGIL)
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'bitacora') {
        main.innerHTML = loadingState();
        try {
            const asigRes = await fetch(`${API_BASE}/estudiante/asignacion?id_estudiante=${user.id}`);
            const asigData = (await asigRes.json()).data;
            if (!asigData) {
                main.innerHTML = errorState('No tienes una práctica activa. Contacta a tu coordinador académico.');
                return;
            }

            // Calcular número de sesión sugerido
            let bitacoras = _estudianteBitacorasCache;
            if (!bitacoras || bitacoras.length === 0) {
                try {
                    const bRes = await fetch(`${API_BASE}/estudiante/bitacoras?id_estudiante=${user.id}`);
                    bitacoras = (await bRes.json()).data || [];
                    _estudianteBitacorasCache = bitacoras;
                } catch (_) {}
            }
            const nextSesion = (bitacoras && bitacoras.length > 0) ? (bitacoras.length + 1) : 1;
            const hoy = new Date().toISOString().split('T')[0];

            // Reset de archivos cargados en memoria
            _archivoPlanCargado = null;
            _archivoEvidenciaCargado = null;

            main.innerHTML = `
            <div class="student-form-container">
                <div class="student-form-header">
                    <div>
                        <h2 style="font-size:18px;font-weight:800;color:var(--text-main);margin:0 0 4px 0;">
                            ✍️ Registro de Bitácora y Plan de Clase
                        </h2>
                        <p class="text-muted" style="font-size:12.5px;margin:0;">
                            Diligencia la información pedagógica de la sesión y adjunta tus soportes didácticos.
                        </p>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span id="autosavePill" class="autosave-status-pill">📝 Borrador local</span>
                        <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="loadEstudianteView('resumen')">
                            ← Volver a Mi Práctica
                        </button>
                    </div>
                </div>

                <div class="student-form-body">
                    <!-- Resumen contextual de la práctica -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#334155;display:flex;flex-wrap:wrap;gap:16px;">
                        <span>📍 <strong>Institución:</strong> ${asigData.institucion || 'Colegio Sede'}</span>
                        <span>👩‍🏫 <strong>Tutor Académico:</strong> ${asigData.tutor || 'Docente UDI'}</span>
                        <span>⏱️ <strong>Meta Horas:</strong> ${asigData.horasAcumuladas || 0}/${asigData.horasRequeridas || 64} hrs</span>
                    </div>

                    <form id="formBitacoraEstudiante" onsubmit="handleSubmitBitacoraEstudiante(event, ${asigData.idAsignacion}, ${asigData.idPractica})">
                        
                        <!-- SECCIÓN 1: DATOS BÁSICOS DE LA SESIÓN -->
                        <div class="form-section-block">
                            <div class="form-section-header">
                                <div class="form-section-badge">1</div>
                                <h3 class="form-section-title">Datos Básicos de la Sesión Pedagógica</h3>
                            </div>

                            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:16px;margin-bottom:16px;">
                                <div>
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">
                                        Sesión N.° *
                                    </label>
                                    <div class="input-wrapper">
                                        <input type="number" id="b-sesion" value="${nextSesion}" min="1" max="99" required placeholder="Ej. 1">
                                    </div>
                                    <small style="font-size:11px;color:#64748b;display:block;margin-top:3px;">Número consecutivo de jornada</small>
                                </div>

                                <div>
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">
                                        Fecha de la Sesión *
                                    </label>
                                    <div class="input-wrapper">
                                        <input type="date" id="b-fecha" value="${hoy}" max="${hoy}" required>
                                    </div>
                                    <small style="font-size:11px;color:#64748b;display:block;margin-top:3px;">No se permiten fechas futuras</small>
                                </div>

                                <div>
                                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">
                                        Horas en Sesión * <span style="font-weight:500;color:#ea580c;">(Máx. 8h)</span>
                                    </label>
                                    <div class="input-wrapper">
                                        <input type="number" id="b-horas" value="4" min="1" max="8" step="0.5" required placeholder="Ej. 4">
                                    </div>
                                    <small style="font-size:11px;color:#64748b;display:block;margin-top:3px;">Reglamento: máx. 8 horas por jornada</small>
                                </div>
                            </div>

                            <!-- Selector opcional de Acompañamiento del Tutor -->
                            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 16px;">
                                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;font-weight:600;color:#0369a1;margin:0;">
                                    <input type="checkbox" id="checkAcompanamientoTutor" style="width:17px;height:17px;" onchange="toggleSelectorVisita(this.checked)">
                                    ¿Esta sesión contó con visita de acompañamiento presencial de tu tutor académico?
                                </label>
                                <div id="panelSelectorVisita" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed #bae6fd;">
                                    <label style="display:block;font-size:12.5px;font-weight:600;margin-bottom:6px;color:#0369a1;">
                                        Selecciona la Visita de Acompañamiento del Tutor:
                                    </label>
                                    <div class="input-wrapper" style="max-width:320px;">
                                        <select id="b-visita-tutor">
                                            <option value="1">Visita 1 — Diagnóstico y Contexto Institucional</option>
                                            <option value="2">Visita 2 — Intervención Pedagógica en Aula</option>
                                            <option value="3">Visita 3 — Consolidación Curricular</option>
                                            <option value="4">Visita 4 — Cierre y Evaluación Formativa</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECCIÓN 2: PLAN DE CLASE (PREPARACIÓN PREVIA) -->
                        <div class="form-section-block">
                            <div class="form-section-header">
                                <div class="form-section-badge" style="background:#0284c7;">2</div>
                                <h3 class="form-section-title">Plan de Clase (Preparación Curricular Previa)</h3>
                            </div>
                            <div class="form-section-tip">
                                <strong>Instrumento curricular previo a la clase:</strong> Adjunta tu planeación didáctica (objetivos, estándares, competencias y recursos preparados antes de impartir la sesión). Puedes subir un archivo directamente desde tu equipo o ingresar un enlace de Google Drive / OneDrive.
                            </div>

                            <!-- Carga de Archivo desde el Dispositivo -->
                            <div class="file-upload-box" id="dropzonePlan" onclick="document.getElementById('fileInputPlan').click()">
                                <input type="file" id="fileInputPlan" style="display:none;" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onchange="handleSelectArchivo(event, 'plan')">
                                <div class="file-upload-icon">📄</div>
                                <div class="file-upload-text">Haz clic aquí para subir el Plan de Clase desde tu PC o dispositivo</div>
                                <div class="file-upload-hint">Formatos aceptados: PDF, Word (.docx), Excel o imagen (máx. 10MB)</div>
                            </div>
                            <div id="plan-file-indicator" class="file-selected-indicator"></div>

                            <!-- Alternativa de Enlace Digital -->
                            <div style="margin-top:10px;">
                                <label style="display:block;font-size:12.5px;font-weight:600;margin-bottom:4px;color:#475569;">
                                    O ingresa un enlace web al Plan de Clase (Google Drive / OneDrive / Enlace institucional):
                                </label>
                                <div class="input-wrapper">
                                    <input type="url" id="b-url-plan" placeholder="https://drive.google.com/... o enlace de tu planeación">
                                </div>
                            </div>
                        </div>

                        <!-- SECCIÓN 3: MOMENTOS DIDÁCTICOS EN AULA -->
                        <div class="form-section-block">
                            <div class="form-section-header">
                                <div class="form-section-badge" style="background:#8b5cf6;">3</div>
                                <h3 class="form-section-title">Momentos Didácticos en el Aula</h3>
                            </div>
                            <div class="form-section-tip">
                                <strong>Modelo Pedagógico UDI:</strong> Describe el desarrollo real de la clase organizado en sus tres momentos formativos esenciales.
                            </div>

                            <div style="margin-bottom:18px;">
                                <label style="display:block;font-size:13px;font-weight:700;color:#854d0e;margin-bottom:6px;">
                                    🟡 Fase 1: Inicio y Motivación Didáctica *
                                </label>
                                <div class="input-wrapper">
                                    <textarea id="b-inicio" rows="3" required placeholder="Ambientación del espacio, motivación, canciones, indagación de conocimientos previos y contextualización de la temática..."></textarea>
                                </div>
                            </div>

                            <div style="margin-bottom:18px;">
                                <label style="display:block;font-size:13px;font-weight:700;color:#1e40af;margin-bottom:6px;">
                                    🔵 Fase 2: Desarrollo y Mediación Pedagógica *
                                </label>
                                <div class="input-wrapper">
                                    <textarea id="b-desarrollo" rows="4" required placeholder="Actividades centrales desarrolladas en el aula, interacción de los niños con el material didáctico, preguntas formuladas y acompañamiento brindado..."></textarea>
                                </div>
                            </div>

                            <div style="margin-bottom:18px;">
                                <label style="display:block;font-size:13px;font-weight:700;color:#166534;margin-bottom:6px;">
                                    🟢 Fase 3: Cierre y Evaluación Formativa *
                                </label>
                                <div class="input-wrapper">
                                    <textarea id="b-cierre" rows="3" required placeholder="Socialización de producciones, consolidación de aprendizajes, dinámicas de evaluación y retroalimentación con los niños..."></textarea>
                                </div>
                            </div>

                            <div>
                                <label style="display:block;font-size:13px;font-weight:700;color:#581c87;margin-bottom:6px;">
                                    🟣 Reflexión Docente Formativa (Preguntas Guía)
                                </label>
                                <div class="input-wrapper">
                                    <textarea id="b-reflexion" rows="2" placeholder="Autoevaluación de tu práctica pedagógica: ¿Qué funcionó con éxito? ¿Qué estrategias metodológicas o acuerdos de convivencia implementaste en esta sesión?"></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- SECCIÓN 4: EVIDENCIAS DE AULA (SOPORTES) -->
                        <div class="form-section-block">
                            <div class="form-section-header">
                                <div class="form-section-badge" style="background:#10b981;">4</div>
                                <h3 class="form-section-title">Evidencias de Aula y Soportes</h3>
                            </div>
                            <div class="form-section-tip">
                                <strong>Soportes formativos:</strong> Fotografías de la actividad, registro de asistencia firmado por el colegio o material elaborado con los estudiantes. Puedes subir un archivo desde tu dispositivo o vincular una carpeta digital.
                            </div>

                            <!-- Carga de Archivo desde el Dispositivo -->
                            <div class="file-upload-box" id="dropzoneEvid" onclick="document.getElementById('fileInputEvid').click()">
                                <input type="file" id="fileInputEvid" style="display:none;" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onchange="handleSelectArchivo(event, 'evidencia')">
                                <div class="file-upload-icon">📎</div>
                                <div class="file-upload-text">Haz clic aquí para subir Evidencias desde tu PC o dispositivo</div>
                                <div class="file-upload-hint">Formatos aceptados: PDF, JPG, PNG o documento de soporte (máx. 10MB)</div>
                            </div>
                            <div id="evid-file-indicator" class="file-selected-indicator"></div>

                            <!-- Alternativa de Enlace Digital -->
                            <div style="margin-top:10px;">
                                <label style="display:block;font-size:12.5px;font-weight:600;margin-bottom:4px;color:#475569;">
                                    O ingresa un enlace a carpeta en la nube (Google Drive / OneDrive):
                                </label>
                                <div class="input-wrapper">
                                    <input type="url" id="b-url-evidencia" placeholder="https://drive.google.com/drive/folders/... o enlace de evidencias">
                                </div>
                            </div>
                        </div>

                        <!-- BOTONES DE ACCIÓN DEL FORMULARIO -->
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:20px;">
                            <div style="display:flex;gap:10px;">
                                <button type="button" class="btn-secondary" onclick="limpiarBorradorEstudiante()">
                                    🗑️ Limpiar Formulario
                                </button>
                                <button type="button" class="btn-secondary" onclick="guardarBorradorManual()">
                                    💾 Guardar Borrador
                                </button>
                            </div>
                            <button type="submit" class="btn-primary-sm" id="btnEnviarBitacora" style="padding:10px 22px;font-size:14px;font-weight:700;">
                                📤 Enviar Bitácora a Revisión
                            </button>
                        </div>
                    </form>
                </div>
            </div>`;

            // Inicializar autoguardado y restaurar borrador previo si existe
            initEstudianteAutosave();
            restaurarBorradorEstudiante();

        } catch (e) {
            main.innerHTML = errorState('Error al cargar el formulario de bitácora: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       3. VISTA: SEGUIMIENTO & CALIFICACIONES
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'evaluaciones') {
        main.innerHTML = loadingState();
        try {
            const [bRes, tRes] = await Promise.all([
                fetch(`${API_BASE}/estudiante/bitacoras?id_estudiante=${user.id}`).then(r => r.json()),
                fetch(`${API_BASE}/estudiante/timeline?id_estudiante=${user.id}`).then(r => r.json())
            ]);

            const bitacoras = bRes.data || [];
            const timeline = tRes.data || [];
            _estudianteBitacorasCache = bitacoras;

            main.innerHTML = `
            <div class="card" style="max-width: 920px; margin: 0 auto;">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">⭐ Seguimiento y Calificaciones Pedagógicas</h3>
                        <p class="text-muted" style="font-size: 12.5px; margin-top: 2px;">
                            Retroalimentación formativa de tu Tutor Académico UDI y aval in-situ del Asesor
                        </p>
                    </div>
                    <button class="btn-primary-sm" onclick="loadEstudianteView('bitacora')">✍️ Nueva Bitácora</button>
                </div>

                <div class="card-body">
                    ${timeline.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">📋</div>
                            <div class="empty-state-title">Aún no hay bitácoras en el historial</div>
                            <p class="empty-state-desc">Al registrar tus bitácoras de práctica, podrás consultar aquí todas las calificaciones y retroalimentaciones formativas.</p>
                            <button class="btn-primary-sm" style="margin-top:16px;" onclick="loadEstudianteView('bitacora')">Registrar Primera Bitácora</button>
                        </div>
                    ` : `
                        <div style="display:flex;flex-direction:column;gap:18px;">
                            ${timeline.map((item, idx) => {
                                const isCalificada = item.estado === 'CALIFICADA' || item.estado === 'APROBADA';
                                const numSesion = item.visita || (idx + 1);
                                return `
                                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(15,23,42,0.03);">
                                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                                        <div>
                                            <h4 style="font-size:16px;font-weight:800;color:var(--text-main);margin:0 0 4px 0;">
                                                Sesión N.° ${numSesion}
                                            </h4>
                                            <div style="font-size:12.5px;color:#64748b;">
                                                📅 ${item.fecha || 'Sin fecha'} &nbsp;•&nbsp; ⏱️ ${item.horas} horas realizadas
                                            </div>
                                        </div>
                                        <div>
                                            <span class="status-badge ${isCalificada ? 'status-open' : 'status-pending'}">
                                                ${isCalificada ? '✓ Calificada y Avalada' : '⏳ En Revisión'}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Bloque de Doble Evaluación (Tutor UDI y Asesor Colegio) -->
                                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;margin-top:12px;">
                                        <!-- Tutor Académico -->
                                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                                <span style="font-size:12.5px;font-weight:700;color:#334155;">
                                                    🎓 Tutor UDI: ${item.tutorEvaluacion ? item.tutorEvaluacion.evaluador : 'En asignación'}
                                                </span>
                                                ${item.tutorEvaluacion && item.tutorEvaluacion.nota != null
                                                    ? `<span style="font-size:15px;font-weight:800;color:var(--success, #10b981);">${item.tutorEvaluacion.nota}/5.0</span>`
                                                    : `<span class="text-muted" style="font-size:11.5px;">Pendiente</span>`}
                                            </div>
                                            <p style="font-size:12px;color:#475569;margin:0;font-style:italic;line-height:1.45;">
                                                ${item.tutorEvaluacion && item.tutorEvaluacion.comentarios
                                                    ? `"${item.tutorEvaluacion.comentarios}"`
                                                    : 'El tutor académico aún no ha registrado la retroalimentación para esta sesión.'}
                                            </p>
                                        </div>

                                        <!-- Asesor In Situ -->
                                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;">
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                                <span style="font-size:12.5px;font-weight:700;color:#166534;">
                                                    🏫 Asesor Colegio: ${item.asesorEvaluacion ? item.asesorEvaluacion.evaluador : 'Docente Titular'}
                                                </span>
                                                ${item.asesorEvaluacion
                                                    ? `<span class="status-badge status-brand" style="font-size:11px;">Aval Otorgado ✓</span>`
                                                    : `<span class="text-muted" style="font-size:11.5px;">Pendiente aval</span>`}
                                            </div>
                                            <p style="font-size:12px;color:#166534;margin:0;line-height:1.45;">
                                                ${item.asesorEvaluacion && item.asesorEvaluacion.comentarios
                                                    ? `"${item.asesorEvaluacion.comentarios}"`
                                                    : 'Observación y visto bueno de desempeño docente in-situ.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div style="margin-top:14px;display:flex;justify-content:flex-end;">
                                        <button class="btn-secondary" style="font-size:12px;padding:5px 12px;" onclick="abrirModalDetalleBitacora(${idx})">
                                            👁️ Ver Detalles de la Sesión
                                        </button>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>`;

        } catch (e) {
            main.innerHTML = errorState('Error al cargar calificaciones: ' + e.message);
        }

    /* ═══════════════════════════════════════════════════════════════════
       FALLBACKS PARA RUTAS ANTERIORES
       ═══════════════════════════════════════════════════════════════════ */
    } else if (tab === 'portafolio' || tab === 'timeline') {
        loadEstudianteView('evaluaciones');
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   FUNCIONES DE SOPORTE, ARCHIVOS Y PERSISTENCIA (ESTUDIANTE)
   ═══════════════════════════════════════════════════════════════════════ */

function toggleSelectorVisita(mostrar) {
    const panel = document.getElementById('panelSelectorVisita');
    if (panel) {
        panel.style.display = mostrar ? 'block' : 'none';
    }
}

function handleSelectArchivo(event, tipo) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        sigpaAlert('Archivo Excede Tamaño', 'El archivo no puede superar los 10MB.', 'warning');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        const sizeKb = (file.size / 1024).toFixed(1);

        if (tipo === 'plan') {
            _archivoPlanCargado = { filename: file.name, base64: base64 };
            const ind = document.getElementById('plan-file-indicator');
            if (ind) {
                ind.style.display = 'flex';
                ind.innerHTML = `
                    <span>📄 <strong>${file.name}</strong> (${sizeKb} KB)</span>
                    <button type="button" class="btn-close" style="font-size:16px;color:#065f46;cursor:pointer;background:none;border:none;" onclick="quitarArchivo('plan')">✕</button>
                `;
            }
        } else if (tipo === 'evidencia') {
            _archivoEvidenciaCargado = { filename: file.name, base64: base64 };
            const ind = document.getElementById('evid-file-indicator');
            if (ind) {
                ind.style.display = 'flex';
                ind.innerHTML = `
                    <span>📎 <strong>${file.name}</strong> (${sizeKb} KB)</span>
                    <button type="button" class="btn-close" style="font-size:16px;color:#065f46;cursor:pointer;background:none;border:none;" onclick="quitarArchivo('evidencia')">✕</button>
                `;
            }
        }
    };
    reader.readAsDataURL(file);
}

function quitarArchivo(tipo) {
    if (tipo === 'plan') {
        _archivoPlanCargado = null;
        const fi = document.getElementById('fileInputPlan');
        if (fi) fi.value = '';
        const ind = document.getElementById('plan-file-indicator');
        if (ind) ind.style.display = 'none';
    } else if (tipo === 'evidencia') {
        _archivoEvidenciaCargado = null;
        const fi = document.getElementById('fileInputEvid');
        if (fi) fi.value = '';
        const ind = document.getElementById('evid-file-indicator');
        if (ind) ind.style.display = 'none';
    }
}

/* ── Autoguardado en LocalStorage ───────────────────────────────────── */
function initEstudianteAutosave() {
    const form = document.getElementById('formBitacoraEstudiante');
    if (!form) return;

    form.addEventListener('input', () => {
        const pill = document.getElementById('autosavePill');
        if (pill) {
            pill.textContent = '⏳ Guardando...';
            pill.classList.remove('saved');
        }

        clearTimeout(_bitacoraDraftTimer);
        _bitacoraDraftTimer = setTimeout(() => {
            const user = getCurrentUser();
            if (!user) return;
            const draft = {
                sesion: document.getElementById('b-sesion') ? document.getElementById('b-sesion').value : '',
                fecha: document.getElementById('b-fecha') ? document.getElementById('b-fecha').value : '',
                horas: document.getElementById('b-horas') ? document.getElementById('b-horas').value : '',
                visitaTutorCheck: document.getElementById('checkAcompanamientoTutor') ? document.getElementById('checkAcompanamientoTutor').checked : false,
                visitaTutor: document.getElementById('b-visita-tutor') ? document.getElementById('b-visita-tutor').value : '1',
                urlPlan: document.getElementById('b-url-plan') ? document.getElementById('b-url-plan').value : '',
                inicio: document.getElementById('b-inicio') ? document.getElementById('b-inicio').value : '',
                desarrollo: document.getElementById('b-desarrollo') ? document.getElementById('b-desarrollo').value : '',
                cierre: document.getElementById('b-cierre') ? document.getElementById('b-cierre').value : '',
                reflexion: document.getElementById('b-reflexion') ? document.getElementById('b-reflexion').value : '',
                urlEvidencia: document.getElementById('b-url-evidencia') ? document.getElementById('b-url-evidencia').value : '',
                guardadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            localStorage.setItem('sigpa_bitacora_draft_' + user.id, JSON.stringify(draft));
            if (pill) {
                pill.textContent = `✓ Guardado (${draft.guardadoEn})`;
                pill.classList.add('saved');
            }
        }, 700);
    });
}

function restaurarBorradorEstudiante() {
    const user = getCurrentUser();
    if (!user) return;
    const raw = localStorage.getItem('sigpa_bitacora_draft_' + user.id);
    if (!raw) return;

    try {
        const draft = JSON.parse(raw);
        if (!draft) return;

        if (draft.sesion && document.getElementById('b-sesion')) document.getElementById('b-sesion').value = draft.sesion;
        if (draft.fecha && document.getElementById('b-fecha')) document.getElementById('b-fecha').value = draft.fecha;
        if (draft.horas && document.getElementById('b-horas')) document.getElementById('b-horas').value = draft.horas;
        if (draft.visitaTutorCheck && document.getElementById('checkAcompanamientoTutor')) {
            document.getElementById('checkAcompanamientoTutor').checked = true;
            toggleSelectorVisita(true);
            if (draft.visitaTutor && document.getElementById('b-visita-tutor')) {
                document.getElementById('b-visita-tutor').value = draft.visitaTutor;
            }
        }
        if (draft.urlPlan && document.getElementById('b-url-plan')) document.getElementById('b-url-plan').value = draft.urlPlan;
        if (draft.inicio && document.getElementById('b-inicio')) document.getElementById('b-inicio').value = draft.inicio;
        if (draft.desarrollo && document.getElementById('b-desarrollo')) document.getElementById('b-desarrollo').value = draft.desarrollo;
        if (draft.cierre && document.getElementById('b-cierre')) document.getElementById('b-cierre').value = draft.cierre;
        if (draft.reflexion && document.getElementById('b-reflexion')) document.getElementById('b-reflexion').value = draft.reflexion;
        if (draft.urlEvidencia && document.getElementById('b-url-evidencia')) document.getElementById('b-url-evidencia').value = draft.urlEvidencia;

        const pill = document.getElementById('autosavePill');
        if (pill && draft.guardadoEn) {
            pill.textContent = `✓ Borrador recuperado (${draft.guardadoEn})`;
            pill.classList.add('saved');
        }
    } catch (_) {}
}

function guardarBorradorManual() {
    const user = getCurrentUser();
    if (!user) return;
    const pill = document.getElementById('autosavePill');
    const draft = {
        sesion: document.getElementById('b-sesion') ? document.getElementById('b-sesion').value : '',
        fecha: document.getElementById('b-fecha') ? document.getElementById('b-fecha').value : '',
        horas: document.getElementById('b-horas') ? document.getElementById('b-horas').value : '',
        visitaTutorCheck: document.getElementById('checkAcompanamientoTutor') ? document.getElementById('checkAcompanamientoTutor').checked : false,
        visitaTutor: document.getElementById('b-visita-tutor') ? document.getElementById('b-visita-tutor').value : '1',
        urlPlan: document.getElementById('b-url-plan') ? document.getElementById('b-url-plan').value : '',
        inicio: document.getElementById('b-inicio') ? document.getElementById('b-inicio').value : '',
        desarrollo: document.getElementById('b-desarrollo') ? document.getElementById('b-desarrollo').value : '',
        cierre: document.getElementById('b-cierre') ? document.getElementById('b-cierre').value : '',
        reflexion: document.getElementById('b-reflexion') ? document.getElementById('b-reflexion').value : '',
        urlEvidencia: document.getElementById('b-url-evidencia') ? document.getElementById('b-url-evidencia').value : '',
        guardadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    localStorage.setItem('sigpa_bitacora_draft_' + user.id, JSON.stringify(draft));
    if (pill) {
        pill.textContent = `✓ Guardado (${draft.guardadoEn})`;
        pill.classList.add('saved');
    }
    sigpaAlert('Borrador Guardado', 'Tu borrador ha sido guardado localmente de forma segura.', 'success');
}

function limpiarBorradorEstudiante() {
    const user = getCurrentUser();
    if (user) {
        localStorage.removeItem('sigpa_bitacora_draft_' + user.id);
    }
    quitarArchivo('plan');
    quitarArchivo('evidencia');
    const form = document.getElementById('formBitacoraEstudiante');
    if (form) form.reset();
    const pill = document.getElementById('autosavePill');
    if (pill) {
        pill.textContent = '📝 Borrador limpio';
        pill.classList.remove('saved');
    }
}

/* ── Envío de Bitácora a Revisión ───────────────────────────────────── */
async function handleSubmitBitacoraEstudiante(e, idAsignacion, idPractica) {
    e.preventDefault();

    const fechaEl = document.getElementById('b-fecha');
    const fechaVal = fechaEl ? fechaEl.value : '';
    if (!fechaVal) {
        sigpaAlert('Fecha Requerida', 'Por favor indica la fecha en que realizaste la sesión pedagógica.', 'warning');
        return;
    }
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    const fechaSesion = new Date(fechaVal + 'T00:00:00');
    if (fechaSesion > hoy) {
        sigpaAlert('Fecha No Válida', 'La fecha de la sesión no puede ser una fecha futura.', 'warning');
        return;
    }

    const horasEl = document.getElementById('b-horas');
    const horasNum = parseFloat(horasEl ? horasEl.value : 0);
    if (isNaN(horasNum) || horasNum <= 0) {
        sigpaAlert('Horas Requeridas', 'Ingresa una cantidad de horas válida (mínimo 1 hora).', 'warning');
        return;
    }
    if (horasNum > 8) {
        sigpaAlert('Límite de Horas Excedido', 'El reglamento institucional prohíbe registrar más de 8 horas en una sola jornada pedagógica.', 'warning');
        return;
    }

    const inicioVal = document.getElementById('b-inicio') ? document.getElementById('b-inicio').value.trim() : '';
    const desarrolloVal = document.getElementById('b-desarrollo') ? document.getElementById('b-desarrollo').value.trim() : '';
    const cierreVal = document.getElementById('b-cierre') ? document.getElementById('b-cierre').value.trim() : '';
    const reflexionVal = document.getElementById('b-reflexion') ? document.getElementById('b-reflexion').value.trim() : '';

    if (!inicioVal || !desarrolloVal || !cierreVal) {
        sigpaAlert('Momentos Didácticos Incompletos', 'Debes diligenciar los tres momentos obligatorios de la sesión (Inicio, Desarrollo y Cierre).', 'warning');
        return;
    }

    const btn = document.getElementById('btnEnviarBitacora');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Subiendo y Registrando...';
    }

    try {
        let urlPlanFinal = document.getElementById('b-url-plan') ? document.getElementById('b-url-plan').value.trim() : '';
        let urlEvidFinal = document.getElementById('b-url-evidencia') ? document.getElementById('b-url-evidencia').value.trim() : '';

        // 1. Subir archivo de Plan de Clase si fue cargado desde el dispositivo
        if (_archivoPlanCargado) {
            try {
                const resUp = await fetch(`${API_BASE}/estudiante/subir-evidencia`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: _archivoPlanCargado.filename,
                        contenido_base64: _archivoPlanCargado.base64
                    })
                });
                const dUp = await resUp.json();
                if (dUp.success && dUp.url) {
                    urlPlanFinal = dUp.url;
                }
            } catch (errUp) {
                console.warn('Advertencia subiendo archivo de plan de clase:', errUp);
            }
        }

        // 2. Subir archivo de Evidencia si fue cargado desde el dispositivo
        if (_archivoEvidenciaCargado) {
            try {
                const resUp = await fetch(`${API_BASE}/estudiante/subir-evidencia`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: _archivoEvidenciaCargado.filename,
                        contenido_base64: _archivoEvidenciaCargado.base64
                    })
                });
                const dUp = await resUp.json();
                if (dUp.success && dUp.url) {
                    urlEvidFinal = dUp.url;
                }
            } catch (errUp) {
                console.warn('Advertencia subiendo archivo de evidencia:', errUp);
            }
        }

        const sesionNum = document.getElementById('b-sesion') ? Number(document.getElementById('b-sesion').value) : 1;
        const acompanamientoTutor = document.getElementById('checkAcompanamientoTutor') && document.getElementById('checkAcompanamientoTutor').checked;
        const visitaTutorNum = acompanamientoTutor && document.getElementById('b-visita-tutor') ? document.getElementById('b-visita-tutor').value : null;

        const payload = {
            id_asignacion: idAsignacion,
            sesion: sesionNum,
            visita: sesionNum,
            fecha: fechaVal,
            horas: horasNum,
            acompanamiento_tutor: acompanamientoTutor ? `Visita ${visitaTutorNum}` : 'NO',
            plan_clase: urlPlanFinal,
            inicio_motivacion: inicioVal,
            desarrollo: desarrolloVal,
            cierre_evaluacion: cierreVal,
            reflexion_docente: reflexionVal,
            evidencia: urlEvidFinal,
        };

        const res = await fetch(`${API_BASE}/estudiante/bitacora`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();

        if (d.success) {
            const user = getCurrentUser();
            if (user) localStorage.removeItem('sigpa_bitacora_draft_' + user.id);
            _archivoPlanCargado = null;
            _archivoEvidenciaCargado = null;

            await sigpaAlert('¡Bitácora Registrada con Éxito!', 'Tu bitácora y plan de clase han sido guardados y notificados a tu tutor académico.', 'success');
            loadEstudianteView('resumen');
        } else {
            sigpaAlert('Atención', d.message || 'Error al guardar la bitácora', 'warning');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📤 Enviar Bitácora a Revisión';
            }
        }
    } catch (err) {
        sigpaAlert('Error de Conexión', 'No fue posible registrar la bitácora: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📤 Enviar Bitácora a Revisión';
        }
    }
}

/* ── Modal de Detalle Completo de Bitácora ───────────────────────────── */
function abrirModalDetalleBitacora(idx) {
    const bit = _estudianteBitacorasCache[idx];
    if (!bit) return;

    const mc = document.getElementById('modalContainer');
    const numSesion = bit.visita || (idx + 1);
    const planUrl = bit.planClase ? resolveEvidenceUrl(bit.planClase) : '';
    const evidUrl = bit.evidencia ? resolveEvidenceUrl(bit.evidencia) : '';

    mc.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 720px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <div>
                    <h3 class="modal-title">📖 Detalle de Bitácora — Sesión N.° ${numSesion}</h3>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">
                        📅 ${bit.fecha || 'Sin fecha'} &nbsp;•&nbsp; ⏱️ ${bit.horas} horas realizadas
                    </div>
                </div>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:18px;">
                <!-- Estado y Calificación -->
                <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;">
                    <div>
                        <span style="font-size:12px;color:#64748b;display:block;">Estado de la Bitácora</span>
                        <span class="status-badge ${bit.estado === 'CALIFICADA' || bit.estado === 'APROBADA' ? 'status-open' : 'status-pending'}">
                            ${bit.estado === 'CALIFICADA' || bit.estado === 'APROBADA' ? 'Aprobada' : 'En Revisión'}
                        </span>
                    </div>
                    ${bit.nota ? `
                    <div style="text-align:right;">
                        <span style="font-size:12px;color:#64748b;display:block;">Calificación Obtenida</span>
                        <strong style="font-size:18px;color:var(--success, #10b981);">${bit.nota}/5.0</strong>
                    </div>` : ''}
                </div>

                <!-- Plan de Clase y Evidencias -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;">
                    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;">
                        <span style="font-size:12px;font-weight:700;color:#0369a1;display:block;margin-bottom:6px;">📄 Plan de Clase Previo:</span>
                        ${planUrl ? `
                            <a href="${planUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary-sm" style="font-size:11.5px;padding:4px 10px;text-decoration:none;display:inline-block;">
                                ↗ Ver / Descargar Plan
                            </a>
                        ` : `<span class="text-muted" style="font-size:12px;">No se adjuntó archivo de planeación.</span>`}
                    </div>

                    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 14px;">
                        <span style="font-size:12px;font-weight:700;color:#065f46;display:block;margin-bottom:6px;">📎 Evidencias de Aula:</span>
                        ${evidUrl ? `
                            <a href="${evidUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="font-size:11.5px;padding:4px 10px;text-decoration:none;display:inline-block;">
                                ↗ Ver Soporte de Evidencia
                            </a>
                        ` : `<span class="text-muted" style="font-size:12px;">No se adjuntó soporte de evidencia.</span>`}
                    </div>
                </div>

                <!-- Momentos Pedagógicos -->
                <div>
                    <h4 style="font-size:13.5px;font-weight:700;color:var(--text-main);margin-bottom:10px;">
                        Desarrollo Didáctico de la Sesión:
                    </h4>
                    ${renderMomentoPedagogicoHTML(bit.actividades, bit.observaciones)}
                </div>

                <!-- Retroalimentación del Tutor -->
                ${bit.comentariosEvaluacion ? `
                <div style="background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:14px;">
                    <strong style="font-size:12.5px;color:#854d0e;display:block;margin-bottom:4px;">
                        💬 Retroalimentación del Tutor Académico:
                    </strong>
                    <p style="font-size:12.5px;color:#713f12;margin:0;font-style:italic;">
                        "${bit.comentariosEvaluacion}"
                    </p>
                </div>` : ''}
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cerrar</button>
            </div>
        </div>
    </div>`;
}

function _renderEstudianteCharts() {
    // Interfaz simplificada y limpia: no se cargan gráficos futuristas innecesarios
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

    } else if (tab === 'preguntas') {
        main.innerHTML = loadingState();
        try {
            const res = await fetch(`${API_BASE}/tutor/banco-preguntas?id_practica=1`);
            const data = await res.json();
            const fases = data.fases || [];
            const preguntas = data.preguntas || [];

            main.innerHTML = `
            <div class="card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div>
                        <h3 class="card-title" style="margin:0;">💡 Fases Pedagógicas y Banco de Preguntas Guía</h3>
                        <p class="text-muted" style="font-size:12.5px;margin:3px 0 0 0;">
                            Orientación formativa asignada por el tutor para acompañar el proceso reflexivo del practicante.
                        </p>
                    </div>
                    <span class="status-badge status-brand">${preguntas.length} preguntas activas</span>
                </div>
                <div class="card-body">
                    <div class="alert-box alert-info" style="margin-bottom:20px;">
                        <strong>ℹ️ Rol Formativo del Tutor Universitario:</strong>
                        Las preguntas guía no están restringidas rígidamente a un número de sesiones de asistencia, sino que acompañan al estudiante a lo largo de las <strong>4 Fases del Proceso Pedagógico</strong>.
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:18px;">
                        ${fases.map(f => {
                            const pregsFase = preguntas.filter(p => p.fase === f.fase);
                            return `
                            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                                    <span class="badge" style="background:#4f46e5;color:white;font-weight:700;">Fase ${f.fase}</span>
                                    <strong style="font-size:13.5px;color:#1e293b;">${f.titulo}</strong>
                                </div>
                                <p style="font-size:12px;color:#64748b;margin:0 0 12px 0;">${f.descripcion}</p>
                                <div style="border-top:1px solid #f1f5f9;padding-top:10px;">
                                    <span style="font-size:11.5px;font-weight:700;color:#0284c7;text-transform:uppercase;">Preguntas Formativas:</span>
                                    <ul style="margin:8px 0 0 0;padding-left:18px;font-size:12.5px;color:#334155;">
                                        ${pregsFase.length > 0 ? pregsFase.map(p => `
                                            <li style="margin-bottom:6px;">
                                                ${p.pregunta}
                                                <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:600;">${p.categoria}</span>
                                            </li>
                                        `).join('') : '<li class="text-muted">Banco estándar UDI cargado por defecto</li>'}
                                    </ul>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        } catch (e) {
            main.innerHTML = errorState('Error al cargar banco pedagógico: ' + e.message);
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

function opcionesSemestres() {
    return '<option value="">Seleccione un semestre</option>' +
        [1, 2, 3].map(n => optionAcademica(n, `Semestre ${n}`)).join('');
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

const MODALIDADES_CURRICULARES = {
    1: { id: 'OBSERVACION', nombre: 'Observación Pedagógica en Aula', horas: 64 },
    2: { id: 'INTERVENCION', nombre: 'Contextualización e Intervención Inicial', horas: 64 },
    3: { id: 'DOCENTE', nombre: 'Práctica Pedagógica y Didáctica Docente', horas: 64 },
    4: { id: 'INVESTIGATIVA', nombre: 'Investigación Educativa en Primera Infancia', horas: 64 },
    5: { id: 'COMUNITARIA', nombre: 'Práctica Integral Comunitaria (Formato P5)', horas: 80 },
    6: { id: 'PROFESIONAL', nombre: 'Práctica de Grado y Liderazgo (Formato P6)', horas: 96 }
};

let conteoEstudiantesSemestres = {};

async function openModalNuevaPractica() {
    try {
        try {
            const resConteo = await fetch(`${API_BASE}/director/conteo-estudiantes`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const dConteo = await resConteo.json();
            if (dConteo.success) conteoEstudiantesSemestres = dConteo.data || {};
        } catch (e) {
            conteoEstudiantesSemestres = {};
        }

        document.getElementById('modalContainer').innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">➕ Habilitar Práctica Pedagógica</h3>
                    <button class="btn-close" onclick="closeModal()">×</button>
                </div>
                <form onsubmit="guardarNuevaPractica(event)">
                    <div class="modal-body">
                        <div style="margin-bottom:14px;">
                            <label for="m-practica-semestre" style="display:block;font-weight:600;margin-bottom:6px;font-size:13.5px;">Semestre Académico *</label>
                            <div class="input-wrapper">
                                <select id="m-practica-semestre" name="semestre" required onchange="actualizarValoresCurriculares(this.value)">
                                    <option value="">Seleccione el semestre</option>
                                    <option value="1">Semestre 1 (P1)</option>
                                    <option value="2">Semestre 2 (P2)</option>
                                    <option value="3">Semestre 3 (P3)</option>
                                    <option value="4">Semestre 4 (P4)</option>
                                    <option value="5">Semestre 5 (P5)</option>
                                    <option value="6">Semestre 6 (P6)</option>
                                </select>
                            </div>
                        </div>

                        <div style="margin-bottom:14px;">
                            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:13.5px;">Nombre de la Asignatura</label>
                            <div class="input-wrapper">
                                <input type="text" id="m-practica-nombre" name="nombre" readonly style="background:#f1f5f9;color:#334155;font-weight:600;" value="Seleccione un semestre...">
                            </div>
                        </div>

                        <div style="margin-bottom:14px;">
                            <label style="display:block;font-weight:600;margin-bottom:6px;font-size:13.5px;">Modalidad Curricular Malla Oficial</label>
                            <div class="input-wrapper">
                                <input type="text" id="m-practica-modalidad-desc" readonly style="background:#f1f5f9;color:#334155;" value="Seleccione un semestre...">
                                <input type="hidden" id="m-practica-tipo" name="tipo" value="OBSERVACION">
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                            <div>
                                <label style="display:block;font-weight:600;margin-bottom:6px;font-size:13.5px;">Población Inscrita</label>
                                <div class="input-wrapper">
                                    <input type="text" id="m-practica-cupos-info" readonly style="background:#f1f5f9;color:#0369a1;font-weight:700;" value="—">
                                </div>
                                <span style="font-size:11px;color:#64748b;">Estudiantes activos en cohorte</span>
                            </div>
                            <div>
                                <label for="m-practica-horas" style="display:block;font-weight:600;margin-bottom:6px;font-size:13.5px;">Horas Requeridas *</label>
                                <div class="input-wrapper">
                                    <input id="m-practica-horas" name="horas" type="number" min="16" max="320" value="64" required style="font-weight:600;">
                                </div>
                                <span style="font-size:11px;color:#64748b;">Definido por dirección</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn-primary-sm" id="btnCrearPractica" disabled>Habilitar Práctica</button>
                    </div>
                </form>
            </div>
        </div>`;
    } catch (error) {
        sigpaAlert('Nueva práctica', error.message, 'error');
    }
}

function actualizarValoresCurriculares(semestre) {
    const sem = Number(semestre);
    const inputNombre = document.getElementById('m-practica-nombre');
    const inputModalidadDesc = document.getElementById('m-practica-modalidad-desc');
    const inputTipo = document.getElementById('m-practica-tipo');
    const inputCuposInfo = document.getElementById('m-practica-cupos-info');
    const inputHoras = document.getElementById('m-practica-horas');
    const btnSubmit = document.getElementById('btnCrearPractica');

    if (!sem || !MODALIDADES_CURRICULARES[sem]) {
        if (inputNombre) inputNombre.value = 'Seleccione un semestre...';
        if (inputModalidadDesc) inputModalidadDesc.value = 'Seleccione un semestre...';
        if (inputTipo) inputTipo.value = '';
        if (inputCuposInfo) inputCuposInfo.value = '—';
        if (btnSubmit) btnSubmit.disabled = true;
        return;
    }

    const mod = MODALIDADES_CURRICULARES[sem];
    const totalEstudiantes = conteoEstudiantesSemestres[sem] || 0;

    if (inputNombre) inputNombre.value = `Práctica Semestre ${sem}`;
    if (inputModalidadDesc) inputModalidadDesc.value = `${mod.id} — ${mod.nombre}`;
    if (inputTipo) inputTipo.value = mod.id;
    if (inputCuposInfo) inputCuposInfo.value = `${totalEstudiantes} estudiantes`;
    if (inputHoras) inputHoras.value = mod.horas || 64;
    if (btnSubmit) btnSubmit.disabled = false;
}

async function guardarNuevaPractica(event) {
    event.preventDefault();
    try {
        const formData = new FormData(event.currentTarget);
        const payload = Object.fromEntries(formData);
        await enviarDatosAcademicos('/director/nueva_practica', payload);
        closeModal();
        await sigpaAlert('Práctica Habilitada', 'La práctica ha sido habilitada exitosamente para la cohorte seleccionada.', 'success');
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

async function confirmarEliminarPractica(id, nombre, asignados) {
    if (asignados > 0) {
        await sigpaAlert('No se puede eliminar', `La práctica "${nombre}" cuenta con ${asignados} estudiante(s) asignado(s). Debe desvincularlos antes de eliminarla.`, 'warning');
        return;
    }
    const confirmado = confirm(`¿Estás seguro de eliminar la práctica "${nombre}"? Esta acción borrará la configuración y preguntas guía asociadas.`);
    if (!confirmado) return;

    try {
        await enviarDatosAcademicos('/director/eliminar_practica', { id_practica: id });
        await sigpaAlert('Práctica Eliminada', `La práctica "${nombre}" fue eliminada correctamente.`, 'success');
        loadDirectorView('practicas');
    } catch (e) {
        sigpaAlert('Error al eliminar', e.message, 'error');
    }
}

async function confirmarEliminarInstitucion(id, nombre, asignados) {
    if (asignados > 0) {
        await sigpaAlert('No se puede eliminar', `La institución "${nombre}" tiene ${asignados} practicante(s) asignado(s) actualmente.`, 'warning');
        return;
    }
    const confirmado = confirm(`¿Estás seguro de eliminar la institución "${nombre}" y su convenio?`);
    if (!confirmado) return;

    try {
        await enviarDatosAcademicos('/director/eliminar_institucion', { id_institucion: id });
        await sigpaAlert('Institución Eliminada', `La institución "${nombre}" fue eliminada correctamente.`, 'success');
        loadDirectorView('instituciones');
    } catch (e) {
        sigpaAlert('Error al eliminar', e.message, 'error');
    }
}

async function openModalAsignarTutorPractica(idPractica, nombrePractica, idTutorActual) {
    try {
        const tutores = await leerDatosAcademicos('/director/tutores');
        document.getElementById('modalContainer').innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 480px;">
                <div class="modal-header">
                    <h3 class="modal-title">👨‍🏫 Asignar Tutor Docente</h3>
                    <button class="btn-close" onclick="closeModal()">×</button>
                </div>
                <form onsubmit="guardarTutorPractica(event, ${idPractica})">
                    <div class="modal-body">
                        <p style="margin-bottom:12px;font-size:13.5px;color:#334155;">
                            Asignar el docente tutor responsable para: <strong>${escaparAcademico(nombrePractica)}</strong>
                        </p>
                        <label for="m-tutor-select" style="display:block;font-weight:600;margin-bottom:6px;font-size:13px;">Tutor Docente</label>
                        <div class="input-wrapper">
                            <select id="m-tutor-select" name="id_tutor" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;background:var(--bg-card);color:var(--text-main);">
                                <option value="">Sin tutor asignado (Desvincular)</option>
                                ${tutores.map(t => `<option value="${t.id}" ${t.id === idTutorActual ? 'selected' : ''}>${escaparAcademico(t.nombre)} (${t.email})</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn-primary-sm">Guardar Asignación</button>
                    </div>
                </form>
            </div>
        </div>`;
    } catch (e) {
        sigpaAlert('Error', 'No se pudieron cargar los tutores: ' + e.message, 'error');
    }
}

async function guardarTutorPractica(event, idPractica) {
    event.preventDefault();
    try {
        const idTutor = document.getElementById('m-tutor-select').value || null;
        await enviarDatosAcademicos('/director/asignar_tutor_practica', {
            id_practica: idPractica,
            id_tutor: idTutor
        });
        closeModal();
        await sigpaAlert('Tutor Asignado', 'El tutor ha sido vinculado a la práctica pedagógica exitosamente.', 'success');
        loadDirectorView('practicas');
    } catch (e) {
        sigpaAlert('Error al asignar tutor', e.message, 'error');
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

        const tienePracticaAbierta = practicas.some(p => p.estado === 'ABIERTA' && p.semestre === Number(seleccion));
        const receptoras = instituciones.filter(i => i.vigente && i.estudiantesAsignados < i.cupos);
        estudiante.innerHTML = '<option value="">Seleccione un estudiante</option>' + estudiantes.map(e =>
            optionAcademica(e.id, `${e.nombre} (Semestre ${e.semestre})`)
        ).join('');
        institucion.innerHTML = '<option value="">Seleccione una institución</option>' + receptoras.map(i =>
            optionAcademica(i.id, `${i.nombre} (${i.cupos - i.estudiantesAsignados} cupos disponibles)`)
        ).join('');
        estudiante.disabled = !estudiantes.length || !tienePracticaAbierta;
        institucion.disabled = !receptoras.length || !tienePracticaAbierta;
        submit.disabled = estudiante.disabled || institucion.disabled;
        estado.textContent = !tienePracticaAbierta ? `No hay una práctica pedagógica abierta para el Semestre ${seleccion}. Debe habilitarla primero en "Nueva Práctica".` :
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
                <h3 class="modal-title">🎯 ${calificada ? 'Bitácora' : 'Calificar bitácora'} — Sesión N.° ${bitacora.visita || visita}</h3>
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

/* ═══════════════════════════════════════════════════════════════════════
   DIRECTOR — MÓDULO DE AUDITORÍA EN TIEMPO REAL E INFORMES CONSOLIDADOS
   ═══════════════════════════════════════════════════════════════════════ */

let _auditoriaCurrentSubtab = 'practicas';
let _auditoriaPracticantesCache = [];
let _auditoriaCuposCache = null;
let _auditoriaPracticasCache = [];

async function descargarPdfBlob(url, defaultFilename) {
    try {
        await sigpaAlert('Generando Documento', 'Compilando informe oficial en formato PDF institucional...', 'info');
        const token = getToken();
        const headers = { 'Accept': 'application/pdf' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}${url}`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.error || `Error ${res.status} al generar el PDF`);
        }

        const blob = await res.blob();
        let filename = defaultFilename || 'documento-sigpa.pdf';
        const cd = res.headers.get('content-disposition');
        if (cd && cd.includes('filename=')) {
            const match = cd.match(/filename="?([^";]+)"?/);
            if (match && match[1]) filename = match[1];
        }

        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        }, 1500);

        await sigpaAlert('Descarga Exitosa', `El documento oficial (${filename}) ha sido descargado correctamente.`, 'success');
    } catch (e) {
        await sigpaAlert('Error de Generación', e.message, 'error');
    }
}

function exportarCsvAcademico(filename, headers, rows) {
    try {
        const escapeCsv = val => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const csvContent = '\uFEFF' + [
            headers.map(escapeCsv).join(';'),
            ...rows.map(row => row.map(escapeCsv).join(';'))
        ].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 1000);
        sigpaAlert('Exportación Completada', `El archivo ${filename} ha sido descargado exitosamente.`, 'success');
    } catch (err) {
        sigpaAlert('Error al exportar', err.message, 'error');
    }
}

async function renderAuditoriaDirector(subtab = 'practicas') {
    _auditoriaCurrentSubtab = subtab;
    const main = document.getElementById('mainContent');
    if (!main) return;

    setTopbarTitle('Auditoría e Informes Consolidados', 'Supervisión de cupos, practicantes y documentos institucionales');

    main.innerHTML = `
        <div class="card" style="margin-bottom:20px;border-left:4px solid var(--primary-color);">
            <div class="card-body" style="padding:16px 20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h2 style="font-size:18px;font-weight:700;color:var(--text-main);margin:0 0 4px 0;">
                            Auditoría de Base de Datos e Informes en Tiempo Real
                        </h2>
                        <p style="font-size:13px;color:var(--text-muted);margin:0;">
                            Consultas de agregación en vivo: fiscalización de convenios, ocupación de cupos y emisión de informes oficiales.
                        </p>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-secondary" onclick="renderAuditoriaDirector('${_auditoriaCurrentSubtab}')" title="Actualizar consultas de base de datos">
                            🔄 Actualizar Datos
                        </button>
                    </div>
                </div>

                <!-- Pestañas de Navegación de Auditoría -->
                <div style="display:flex;gap:10px;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;flex-wrap:wrap;">
                    <button class="btn-tab ${_auditoriaCurrentSubtab === 'practicas' ? 'btn-primary-sm' : 'btn-secondary'}"
                            onclick="renderAuditoriaDirector('practicas')" style="font-size:13px;padding:8px 16px;">
                        📚 Informe por Práctica Pedagógica
                    </button>
                    <button class="btn-tab ${_auditoriaCurrentSubtab === 'cupos' ? 'btn-primary-sm' : 'btn-secondary'}"
                            onclick="renderAuditoriaDirector('cupos')" style="font-size:13px;padding:8px 16px;">
                        🏫 Auditoría de Cupos e Instituciones
                    </button>
                    <button class="btn-tab ${_auditoriaCurrentSubtab === 'practicantes' ? 'btn-primary-sm' : 'btn-secondary'}"
                            onclick="renderAuditoriaDirector('practicantes')" style="font-size:13px;padding:8px 16px;">
                        👥 Auditoría General de Practicantes
                    </button>
                </div>
            </div>
        </div>

        <div id="contenedorAuditoriaDirector">
            ${loadingState()}
        </div>
    `;

    if (subtab === 'practicas') {
        await renderSubtabInformePractica();
    } else if (subtab === 'cupos') {
        await renderSubtabAuditoriaCupos();
    } else if (subtab === 'practicantes') {
        await renderSubtabAuditoriaPracticantes();
    }
}

async function renderSubtabInformePractica() {
    const contenedor = document.getElementById('contenedorAuditoriaDirector');
    if (!contenedor) return;

    try {
        const consolData = await leerDatosAcademicos('/director/auditoria/consolidado-practicas');
        _auditoriaPracticasCache = consolData || [];

        if (_auditoriaPracticasCache.length === 0) {
            contenedor.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <h3 class="empty-state-title">No hay prácticas pedagógicas registradas</h3>
                    <p class="empty-state-desc">Crea una nueva práctica curricular desde el botón superior para comenzar.</p>
                </div>`;
            return;
        }

        const primeraPracticaId = _auditoriaPracticasCache[0].id;

        contenedor.innerHTML = `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-body" style="padding:16px 20px;">
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <label for="selAuditoriaPractica" style="font-weight:600;font-size:13.5px;color:var(--text-main);">
                            Seleccionar Práctica Curricular:
                        </label>
                        <select id="selAuditoriaPractica" class="form-control" style="max-width:380px;padding:8px 12px;font-size:13.5px;border-radius:6px;border:1px solid #cbd5e1;"
                                onchange="mostrarDetalleAuditoriaPractica(Number(this.value))">
                            ${_auditoriaPracticasCache.map(p => `
                                <option value="${p.id}">
                                    ${escaparAcademico(p.nombre)} · Semestre ${p.semestre} (${p.tipo})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>
            <div id="detalleAuditoriaPractica">
                ${loadingState()}
            </div>
        `;

        await mostrarDetalleAuditoriaPractica(primeraPracticaId);
    } catch (err) {
        contenedor.innerHTML = errorState('Error al cargar prácticas: ' + err.message);
    }
}

async function mostrarDetalleAuditoriaPractica(idPractica) {
    const contenedor = document.getElementById('detalleAuditoriaPractica');
    if (!contenedor) return;
    contenedor.innerHTML = loadingState();

    try {
        const p = _auditoriaPracticasCache.find(x => x.id === idPractica);
        const result = await leerDatosAcademicos(`/director/auditoria/practicantes?id_practica=${idPractica}`);
        const practicantes = (result && result.practicantes) ? result.practicantes : [];

        const totalHrs = practicantes.reduce((sum, s) => sum + (s.horasAcumuladas || 0), 0);
        const promAvance = practicantes.length > 0 && p && p.horas > 0
            ? Math.round((totalHrs / (practicantes.length * p.horas)) * 100)
            : 0;

        contenedor.innerHTML = `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h3 class="card-title" style="font-size:16px;">
                            ${escaparAcademico(p ? p.nombre : 'Práctica Pedagógica')}
                        </h3>
                        <span style="font-size:12.5px;color:var(--text-muted);">
                            Semestre ${p ? p.semestre : 1} · Modalidad: <strong>${p ? p.tipo : 'OBSERVACIÓN'}</strong> · Requisito: <strong>${p ? p.horas : 64} horas</strong>
                        </span>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button class="btn-primary-sm" onclick="descargarPdfBlob('/director/reportes/practica/${idPractica}/pdf', 'informe-practica-${idPractica}.pdf')">
                            📄 Descargar Informe Oficial (PDF)
                        </button>
                        <button class="btn-secondary" onclick="exportarCsvPractica(${idPractica})">
                            📊 Exportar a Excel (CSV)
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="kpi-row" style="margin-bottom:20px;">
                        ${kpiCard('kpi-accent','kpi-icon-accent','👥','Matriculados Semestre', p ? p.totalMatriculados : practicantes.length, 'Población cohorte', null, .05)}
                        ${kpiCard('kpi-teal','kpi-icon-teal','🏫','Plazas Asignadas', practicantes.length, `${p ? p.sinPlaza : 0} pendientes de plaza`, null, .10)}
                        ${kpiCard('kpi-success','kpi-icon-success','⏱️','Horas Acumuladas', `${totalHrs} h`, `Meta: ${p ? (p.horas * practicantes.length) : 0} h`, null, .15)}
                        ${kpiCard('kpi-warning','kpi-icon-warning','📈','Avance Promedio', `${promAvance}%`, 'Cumplimiento global', null, .20)}
                    </div>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                        <div>
                            <span style="font-size:12px;color:var(--text-muted);display:block;">DOCENTE TUTOR RESPONSABLE</span>
                            <strong style="font-size:14px;color:var(--text-main);">
                                👨‍🏫 ${escaparAcademico(p && p.tutor ? p.tutor : 'Sin tutor asignado')}
                            </strong>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:12px;color:var(--text-muted);display:block;">ESTADO DEL CURSO</span>
                            <span class="badge ${p && p.estado === 'ABIERTA' ? 'badge-success' : 'badge-muted'}" style="font-size:12px;">
                                ${p ? p.estado : 'ABIERTA'}
                            </span>
                        </div>
                    </div>

                    <h4 style="font-size:14px;font-weight:700;margin:0 0 12px 0;color:var(--text-main);">
                        Estudiantes en Práctica y Auditoría de Horas
                    </h4>

                    ${practicantes.length === 0 ? `
                        <div style="padding:24px;text-align:center;background:#f8fafc;border-radius:8px;color:var(--text-muted);">
                            No hay estudiantes asignados a esta práctica curricular todavía.
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Estudiante</th>
                                        <th>Institución Receptora</th>
                                        <th>Horas Validadas</th>
                                        <th>% Avance</th>
                                        <th>Bitácoras</th>
                                        <th>Calificación</th>
                                        <th>Estado Auditoría</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${practicantes.map(s => {
                                        const pct = s.porcentajeCumplimiento || 0;
                                        return `
                                            <tr>
                                                <td>
                                                    <strong>${escaparAcademico(s.estudiante)}</strong>
                                                    <small class="text-muted" style="display:block;">${escaparAcademico(s.email)}</small>
                                                </td>
                                                <td>
                                                    <span style="font-size:13px;font-weight:500;">
                                                        🏫 ${escaparAcademico(s.institucion)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <strong style="color:var(--primary-color);">${s.horasAcumuladas}</strong>
                                                    <span class="text-muted">/ ${s.horasRequeridas} h</span>
                                                </td>
                                                <td>
                                                    <div style="display:flex;align-items:center;gap:8px;">
                                                        <div style="flex:1;background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;min-width:60px;">
                                                            <div style="width:${pct}%;background:${pct >= 100 ? '#10b981' : (pct >= 50 ? '#4f46e5' : '#f59e0b')};height:100%;"></div>
                                                        </div>
                                                        <span style="font-size:11.5px;font-weight:600;">${pct}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style="font-size:12px;">
                                                        ${s.totalBitacoras} registradas
                                                        ${s.bitacorasPendientes > 0 ? `<span style="color:#d97706;font-weight:600;">(${s.bitacorasPendientes} pend)</span>` : ''}
                                                    </span>
                                                </td>
                                                <td>
                                                    ${s.notaDefinitiva != null ? `<strong style="color:#10b981;">⭐ ${s.notaDefinitiva}</strong>` : '<span class="text-muted">—</span>'}
                                                </td>
                                                <td>
                                                    <span class="badge ${s.estadoAuditoria === 'LISTO_PARA_ACTA' ? 'badge-success' : (s.estadoAuditoria === 'REZAGADO' ? 'badge-warning' : 'badge-primary')}">
                                                        ${s.estadoAuditoria === 'LISTO_PARA_ACTA' ? '✔ 100% LISTO' : (s.estadoAuditoria === 'REZAGADO' ? '⚠️ REZAGADO' : 'EN CURSO')}
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (err) {
        contenedor.innerHTML = errorState('Error al cargar detalle de la práctica: ' + err.message);
    }
}

function exportarCsvPractica(idPractica) {
    const p = _auditoriaPracticasCache.find(x => x.id === idPractica);
    leerDatosAcademicos(`/director/auditoria/practicantes?id_practica=${idPractica}`).then(res => {
        const practicantes = (res && res.practicantes) ? res.practicantes : [];
        const headers = ['Estudiante', 'Email', 'Semestre', 'Práctica', 'Modalidad', 'Institución', 'Tutor', 'Horas Acumuladas', 'Horas Requeridas', '% Avance', 'Bitácoras Totales', 'Bitácoras Pendientes', 'Calificación', 'Estado'];
        const rows = practicantes.map(s => [
            s.estudiante,
            s.email,
            s.semestre,
            s.practica,
            s.modalidad,
            s.institucion,
            s.tutor,
            s.horasAcumuladas,
            s.horasRequeridas,
            `${s.porcentajeCumplimiento}%`,
            s.totalBitacoras,
            s.bitacorasPendientes,
            s.notaDefinitiva != null ? s.notaDefinitiva : 'Pendiente',
            s.estadoAuditoria
        ]);
        exportarCsvAcademico(`consolidado-practica-${idPractica}.csv`, headers, rows);
    });
}

async function renderSubtabAuditoriaCupos() {
    const contenedor = document.getElementById('contenedorAuditoriaDirector');
    if (!contenedor) return;
    contenedor.innerHTML = loadingState();

    try {
        const res = await leerDatosAcademicos('/director/auditoria/cupos-instituciones');
        _auditoriaCuposCache = res || { resumen: {}, instituciones: [] };
        const resumen = _auditoriaCuposCache.resumen || {};
        const instituciones = _auditoriaCuposCache.instituciones || [];

        contenedor.innerHTML = `
            <div class="kpi-row" style="margin-bottom:20px;">
                ${kpiCard('kpi-accent','kpi-icon-accent','🏫','Instituciones Aliadas', resumen.totalInstituciones || 0, 'Sedes con convenio', null, .05)}
                ${kpiCard('kpi-teal','kpi-icon-teal','🪑','Capacidad Instalada', `${resumen.cuposTotales || 0} cupos`, 'Ofertados en convenios', null, .10)}
                ${kpiCard('kpi-warning','kpi-icon-warning','👥','Cupos Asignados', `${resumen.cuposOcupados || 0} (${resumen.tasaOcupacion || 0}%)`, 'Practicantes vinculados', null, .15)}
                ${kpiCard('kpi-success','kpi-icon-success','🟢','Cupos Disponibles', `${resumen.cuposLibres || 0} libres`, 'Plazas vacantes', null, .20)}
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div>
                        <h3 class="card-title" style="font-size:16px;">
                            Fiscalización de Cupos y Convenios en Tiempo Real
                        </h3>
                        <span style="font-size:12.5px;color:var(--text-muted);">
                            Auditoría de saturación de sedes receptoras y vigencia legal de convenios institucionales
                        </span>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button class="btn-primary-sm" onclick="descargarPdfBlob('/director/reportes/cupos/pdf', 'auditoria-cupos-instituciones.pdf')">
                            📄 Descargar Auditoría (PDF)
                        </button>
                        <button class="btn-secondary" onclick="exportarCsvCupos()">
                            📊 Exportar a Excel (CSV)
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Institución Receptora</th>
                                    <th>Convenio</th>
                                    <th>Vencimiento</th>
                                    <th>Ofertados</th>
                                    <th>Ocupados</th>
                                    <th>Libres</th>
                                    <th>Ocupación (%)</th>
                                    <th>Alerta Capacidad</th>
                                    <th>Practicantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${instituciones.length === 0 ? `
                                    <tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted);">No hay instituciones registradas en el catálogo.</td></tr>
                                ` : instituciones.map(inst => {
                                    const pct = inst.porcentajeOcupacion || 0;
                                    const alertaClass = inst.alertaCapacidad === 'SATURADA' ? 'badge-danger' : (inst.alertaCapacidad === 'ALTA' ? 'badge-warning' : 'badge-success');
                                    const alertaTexto = inst.alertaCapacidad === 'SATURADA' ? '🔴 SATURADA' : (inst.alertaCapacidad === 'ALTA' ? '🟠 ALTA' : '🟢 DISPONIBLE');

                                    return `
                                        <tr>
                                            <td>
                                                <strong style="font-size:13.5px;color:var(--text-main);">${escaparAcademico(inst.nombre)}</strong>
                                                ${inst.direccion ? `<small class="text-muted" style="display:block;">📍 ${escaparAcademico(inst.direccion)}</small>` : ''}
                                            </td>
                                            <td>
                                                <span class="badge ${inst.convenioActivo ? 'badge-success' : 'badge-danger'}">
                                                    ${inst.convenioActivo ? '✔ VIGENTE' : '✖ INACTIVO'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style="font-size:12.5px;">${inst.vencimiento || 'Indefinido'}</span>
                                                ${inst.diasRestantes != null && inst.diasRestantes <= 30 && inst.diasRestantes >= 0
                                                    ? `<small style="display:block;color:#d97706;font-weight:600;">(vence en ${inst.diasRestantes} días)</small>`
                                                    : ''}
                                            </td>
                                            <td><strong>${inst.cuposTotales}</strong></td>
                                            <td><strong style="color:${inst.cuposOcupados >= inst.cuposTotales && inst.cuposTotales > 0 ? '#dc2626' : 'var(--text-main)'};">${inst.cuposOcupados}</strong></td>
                                            <td><strong style="color:${inst.cuposLibres > 0 ? '#10b981' : 'var(--text-muted)'};">${inst.cuposLibres}</strong></td>
                                            <td>
                                                <div style="display:flex;align-items:center;gap:8px;">
                                                    <div style="flex:1;background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;min-width:60px;">
                                                        <div style="width:${pct}%;background:${pct >= 100 ? '#ef4444' : (pct >= 70 ? '#f59e0b' : '#10b981')};height:100%;"></div>
                                                    </div>
                                                    <span style="font-size:11.5px;font-weight:600;">${pct}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span class="badge ${alertaClass}">${alertaTexto}</span>
                                            </td>
                                            <td>
                                                <button class="btn-secondary" style="font-size:11.5px;padding:4px 8px;"
                                                        onclick="verPracticantesInstitucion(${inst.id}, '${escaparAcademico(inst.nombre).replace(/'/g, "\\'")}')">
                                                    👥 Ver (${inst.practicantes ? inst.practicantes.length : 0})
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        contenedor.innerHTML = errorState('Error al cargar auditoría de cupos: ' + err.message);
    }
}

function exportarCsvCupos() {
    if (!_auditoriaCuposCache || !_auditoriaCuposCache.instituciones) return;
    const headers = ['Institución', 'Dirección', 'Teléfono', 'Convenio Activo', 'Fecha Vencimiento', 'Cupos Ofertados', 'Cupos Ocupados', 'Cupos Libres', '% Ocupación', 'Estado Capacidad', 'Estudiantes Finalizados'];
    const rows = _auditoriaCuposCache.instituciones.map(i => [
        i.nombre,
        i.direccion,
        i.telefono,
        i.convenioActivo ? 'S' : 'N',
        i.vencimiento,
        i.cuposTotales,
        i.cuposOcupados,
        i.cuposLibres,
        `${i.porcentajeOcupacion}%`,
        i.alertaCapacidad,
        i.estudiantesFinalizados
    ]);
    exportarCsvAcademico('auditoria-cupos-instituciones.csv', headers, rows);
}

function verPracticantesInstitucion(idInst, nombreInst) {
    if (!_auditoriaCuposCache || !_auditoriaCuposCache.instituciones) return;
    const inst = _auditoriaCuposCache.instituciones.find(x => x.id === idInst);
    const practicantes = inst && inst.practicantes ? inst.practicantes : [];

    const mc = document.getElementById('modalContainer');
    mc.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 680px;">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title">👥 Practicantes en ${escaparAcademico(nombreInst)}</h3>
                        <small class="text-muted">Total estudiantes asignados: ${practicantes.length}</small>
                    </div>
                    <button class="btn-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${practicantes.length === 0 ? `
                        <p style="padding:20px;text-align:center;color:var(--text-muted);">No hay practicantes asignados actualmente en esta institución.</p>
                    ` : `
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Estudiante</th>
                                        <th>Práctica / Semestre</th>
                                        <th>Tutor</th>
                                        <th>Horas Validadas</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${practicantes.map(s => `
                                        <tr>
                                            <td>
                                                <strong>${escaparAcademico(s.estudiante)}</strong>
                                                <small class="text-muted" style="display:block;">${escaparAcademico(s.email)}</small>
                                            </td>
                                            <td>
                                                <span>${escaparAcademico(s.practica)}</span>
                                                <small class="text-muted" style="display:block;">Semestre ${s.semestre}</small>
                                            </td>
                                            <td>👨‍🏫 ${escaparAcademico(s.tutor)}</td>
                                            <td><strong>${s.horasAcumuladas}</strong> / ${s.horasRequeridas} h</td>
                                            <td><span class="badge badge-primary">${s.estado}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

async function renderSubtabAuditoriaPracticantes() {
    const contenedor = document.getElementById('contenedorAuditoriaDirector');
    if (!contenedor) return;
    contenedor.innerHTML = loadingState();

    try {
        const res = await leerDatosAcademicos('/director/auditoria/practicantes');
        _auditoriaPracticantesCache = (res && res.practicantes) ? res.practicantes : [];
        const resumen = (res && res.resumen) ? res.resumen : {};

        contenedor.innerHTML = `
            <div class="kpi-row" style="margin-bottom:20px;">
                ${kpiCard('kpi-accent','kpi-icon-accent','👥','Practicantes en Red', resumen.totalPracticantes || 0, 'Total inscritos', null, .05)}
                ${kpiCard('kpi-success','kpi-icon-success','⏱️','Horas Validadas', `${resumen.totalHorasValidadas || 0} h`, 'Acumuladas en bitácoras', null, .10)}
                ${kpiCard('kpi-warning','kpi-icon-warning','📈','Cumplimiento Global', `${resumen.promedioAvanceGlobal || 0}%`, 'Avance curricular', null, .15)}
                ${kpiCard('kpi-teal','kpi-icon-teal','🎓','Listos para Acta', `${resumen.listosParaActa || 0}`, `${resumen.rezagados || 0} rezagados`, null, .20)}
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-body" style="padding:14px 20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                            <label style="font-size:13px;font-weight:600;color:var(--text-main);">Filtrar por Semestre:</label>
                            <select id="filtroAuditSemestre" class="form-control" style="padding:6px 10px;font-size:13px;border-radius:6px;"
                                    onchange="aplicarFiltrosAuditoriaPracticantes()">
                                <option value="">Todos los semestres</option>
                                <option value="1">Semestre 1</option>
                                <option value="2">Semestre 2</option>
                                <option value="3">Semestre 3</option>
                                <option value="4">Semestre 4</option>
                                <option value="5">Semestre 5</option>
                            </select>

                            <label style="font-size:13px;font-weight:600;color:var(--text-main);">Estado:</label>
                            <select id="filtroAuditEstado" class="form-control" style="padding:6px 10px;font-size:13px;border-radius:6px;"
                                    onchange="aplicarFiltrosAuditoriaPracticantes()">
                                <option value="">Todos los estados</option>
                                <option value="LISTO_PARA_ACTA">Listos para Acta (100%)</option>
                                <option value="REZAGADO">Rezagados (< 40%)</option>
                                <option value="EN_CURSO">En curso</option>
                                <option value="FINALIZADA">Finalizadas</option>
                            </select>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn-secondary" onclick="exportarCsvPracticantesGeneral()">
                                📊 Exportar Listado a Excel (CSV)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title" style="font-size:15px;">
                        Auditoría Pormenorizada de Practicantes y Emisión de Actas
                    </h3>
                </div>
                <div class="card-body" id="tablaAuditoriaPracticantesContenedor">
                    ${generarHtmlTablaAuditoriaPracticantes(_auditoriaPracticantesCache)}
                </div>
            </div>
        `;
    } catch (err) {
        contenedor.innerHTML = errorState('Error al cargar auditoría de practicantes: ' + err.message);
    }
}

function generarHtmlTablaAuditoriaPracticantes(practicantes) {
    if (!practicantes || practicantes.length === 0) {
        return '<p style="text-align:center;padding:24px;color:var(--text-muted);">No se encontraron practicantes con los filtros seleccionados.</p>';
    }

    return `
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Estudiante</th>
                        <th>Semestre / Práctica</th>
                        <th>Institución Receptora</th>
                        <th>Tutor Docente</th>
                        <th>Horas Validadas</th>
                        <th>% Avance</th>
                        <th>Bitácoras</th>
                        <th>Calificación</th>
                        <th>Estado Auditoría</th>
                        <th>Acción Oficial</th>
                    </tr>
                </thead>
                <tbody>
                    ${practicantes.map(s => {
                        const pct = s.porcentajeCumplimiento || 0;
                        const apto = s.aptoParaActa || s.estadoPractica === 'FINALIZADA';
                        const badgeClass = s.estadoAuditoria === 'LISTO_PARA_ACTA' ? 'badge-success' : (s.estadoAuditoria === 'REZAGADO' ? 'badge-warning' : (s.estadoAuditoria === 'FINALIZADA' ? 'badge-primary' : 'badge-secondary'));

                        return `
                            <tr>
                                <td>
                                    <strong>${escaparAcademico(s.estudiante)}</strong>
                                    <small class="text-muted" style="display:block;">${escaparAcademico(s.email)}</small>
                                </td>
                                <td>
                                    <span>${escaparAcademico(s.practica)}</span>
                                    <small class="text-muted" style="display:block;">Semestre ${s.semestre}</small>
                                </td>
                                <td>🏫 ${escaparAcademico(s.institucion)}</td>
                                <td>👨‍🏫 ${escaparAcademico(s.tutor)}</td>
                                <td><strong>${s.horasAcumuladas}</strong> / ${s.horasRequeridas} h</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:6px;">
                                        <div style="flex:1;background:#e2e8f0;height:6px;border-radius:3px;overflow:hidden;min-width:45px;">
                                            <div style="width:${pct}%;background:${pct >= 100 ? '#10b981' : (pct >= 50 ? '#4f46e5' : '#f59e0b')};height:100%;"></div>
                                        </div>
                                        <span style="font-size:11px;font-weight:600;">${pct}%</span>
                                    </div>
                                </td>
                                <td>
                                    <span style="font-size:12px;">
                                        ${s.totalBitacoras}
                                        ${s.bitacorasPendientes > 0 ? `<small style="color:#d97706;display:block;">(${s.bitacorasPendientes} pend)</small>` : ''}
                                    </span>
                                </td>
                                <td>
                                    ${s.notaDefinitiva != null ? `<strong style="color:#10b981;">⭐ ${s.notaDefinitiva}</strong>` : '<span class="text-muted">—</span>'}
                                </td>
                                <td>
                                    <span class="badge ${badgeClass}">
                                        ${s.estadoAuditoria === 'LISTO_PARA_ACTA' ? '✔ LISTO ACTA' : (s.estadoAuditoria === 'REZAGADO' ? '⚠️ REZAGADO' : s.estadoAuditoria)}
                                    </span>
                                </td>
                                <td>
                                    ${apto ? `
                                        <button class="btn-primary-sm" style="font-size:11px;padding:4px 8px;white-space:nowrap;"
                                                onclick="descargarPdfBlob('/director/reportes/acta/${s.idAsignacion}/pdf', 'acta-cierre-${s.idAsignacion}.pdf')">
                                            🎓 Acta PDF
                                        </button>
                                    ` : `
                                        <small class="text-muted" style="font-size:11px;">Faltan ${Math.max(0, s.horasRequeridas - s.horasAcumuladas)}h</small>
                                    `}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function aplicarFiltrosAuditoriaPracticantes() {
    const sem = document.getElementById('filtroAuditSemestre') ? document.getElementById('filtroAuditSemestre').value : '';
    const est = document.getElementById('filtroAuditEstado') ? document.getElementById('filtroAuditEstado').value : '';

    let filtrados = _auditoriaPracticantesCache.slice();
    if (sem) {
        filtrados = filtrados.filter(s => String(s.semestre) === String(sem) || String(s.semestrePractica) === String(sem));
    }
    if (est) {
        filtrados = filtrados.filter(s => s.estadoAuditoria === est || s.estadoPractica === est);
    }

    const contenedor = document.getElementById('tablaAuditoriaPracticantesContenedor');
    if (contenedor) {
        contenedor.innerHTML = generarHtmlTablaAuditoriaPracticantes(filtrados);
    }
}

function exportarCsvPracticantesGeneral() {
    if (!_auditoriaPracticantesCache || _auditoriaPracticantesCache.length === 0) return;
    const headers = ['Estudiante', 'Email', 'Semestre', 'Práctica', 'Modalidad', 'Institución', 'Tutor', 'Horas Acumuladas', 'Horas Requeridas', '% Cumplimiento', 'Total Bitácoras', 'Bitácoras Pendientes', 'Calificación', 'Estado Auditoría'];
    const rows = _auditoriaPracticantesCache.map(s => [
        s.estudiante,
        s.email,
        s.semestre,
        s.practica,
        s.modalidad,
        s.institucion,
        s.tutor,
        s.horasAcumuladas,
        s.horasRequeridas,
        `${s.porcentajeCumplimiento}%`,
        s.totalBitacoras,
        s.bitacorasPendientes,
        s.notaDefinitiva != null ? s.notaDefinitiva : 'Pendiente',
        s.estadoAuditoria
    ]);
    exportarCsvAcademico('auditoria-general-practicantes.csv', headers, rows);
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
                <h3 class="modal-title">✅ Aval In Situ — Sesión N.° ${visita}</h3>
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
            `${API_BASE}/director/reportes/visita-pdf`,
            `${API_BASE}/v1/reports/visita-pdf`,
            `${API_BASE.replace('/api', '')}/api/v1/reports/visita-pdf`,
            'http://localhost:3000/api/v1/reports/visita-pdf',
            'http://localhost:5001/api/v1/reports/visita-pdf'
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
            `${API_BASE}/director/reportes/acta-cierre-pdf`,
            `${API_BASE}/v1/reports/acta-cierre-pdf`,
            `${API_BASE.replace('/api', '')}/api/v1/reports/acta-cierre-pdf`,
            'http://localhost:3000/api/v1/reports/acta-cierre-pdf',
            'http://localhost:5001/api/v1/reports/acta-cierre-pdf'
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
                            <strong style="font-size:13.5px;color:var(--text-main);display:block;">📄 Informe de Supervisión y Acompañamiento (CU-13)</strong>
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


/* ═══════════════════════════════════════════════════════════════════════
   MÓDULO DE ASISTENCIA PRESENCIAL POR CÓDIGO QR (ESTUDIANTE & ASESOR)
   ═══════════════════════════════════════════════════════════════════════ */

let _html5QrCodeScanner = null;

/**
 * Abre el modal del Estudiante con su Código QR de Asistencia Dinámico
 */
async function abrirModalQrEstudiante() {
    const user = getCurrentUser();
    const container = document.getElementById('modalContainer');
    if (!container) return;

    container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 440px; text-align: center;">
            <div class="modal-header" style="justify-content:center;position:relative;">
                <h3 class="modal-title" style="margin:0;font-size:17px;font-weight:800;color:var(--text-main);">
                    📱 Registro de Asistencia Presencial
                </h3>
                <button class="btn-close" onclick="closeModal()" style="position:absolute;right:16px;">×</button>
            </div>
            <div class="modal-body" style="padding:24px 20px;">
                <p class="text-muted" style="font-size:13px;margin:0 0 16px 0;">
                    Presenta este código al <strong>Asesor In Situ</strong> al ingresar a la institución educativa para certificar tu presencia física.
                </p>

                <div id="qrLoadingState" style="padding:28px 0;">
                    <div style="font-size:32px;animation:spin 1s infinite linear;">⏳</div>
                    <span style="font-size:12.5px;color:#64748b;display:block;margin-top:8px;">Generando código seguro...</span>
                </div>

                <div id="qrCardBox" style="display:none;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:14px;padding:20px;margin-bottom:16px;">
                    <div id="qrcodeCanvasContainer" style="display:flex;justify-content:center;margin-bottom:12px;"></div>
                    <div id="qrInfoStudent" style="font-size:12px;color:#334155;font-weight:600;"></div>
                    <div style="font-size:11px;color:#0284c7;margin-top:4px;">⏱️ Vigencia: 15 minutos (Token de sesión segura)</div>
                </div>

                <button class="btn-secondary" style="width:100%;padding:10px;font-size:13px;" onclick="cargarQrEstudiante()">
                    🔄 Regenerar Código QR
                </button>
            </div>
        </div>
    </div>`;

    await cargarQrEstudiante();
}

/**
 * Llama al backend para obtener el token efímero y renderiza el QR con QRCode.js
 */
async function cargarQrEstudiante() {
    const user = getCurrentUser();
    const loadBox = document.getElementById('qrLoadingState');
    const cardBox = document.getElementById('qrCardBox');
    const qrContainer = document.getElementById('qrcodeCanvasContainer');
    const infoText = document.getElementById('qrInfoStudent');

    if (loadBox) loadBox.style.display = 'block';
    if (cardBox) cardBox.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/estudiante/generar-qr-asistencia`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ id_estudiante: user.id })
        });
        const d = await res.json();

        if (d.success && d.qrToken) {
            if (qrContainer) {
                qrContainer.innerHTML = '';
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qrContainer, {
                        text: d.qrToken,
                        width: 190,
                        height: 190,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } else {
                    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(d.qrToken)}" alt="QR Asistencia">`;
                }
            }

            if (infoText) {
                infoText.innerHTML = `<strong>${d.datos.estudiante}</strong><br><span style="color:#64748b;">${d.datos.institucion}</span>`;
            }

            if (loadBox) loadBox.style.display = 'none';
            if (cardBox) cardBox.style.display = 'block';
        } else {
            if (loadBox) loadBox.innerHTML = `<span style="color:#ef4444;font-size:12.5px;">⚠️ ${d.message || 'Error al generar QR'}</span>`;
        }
    } catch (e) {
        if (loadBox) loadBox.innerHTML = `<span style="color:#ef4444;font-size:12.5px;">❌ Error de conexión: ${e.message}</span>`;
    }
}

/**
 * Abre el modal del Asesor In Situ con el lector de cámara web/móvil
 */
function abrirModalEscanerAsesor() {
    const container = document.getElementById('modalContainer');
    if (!container) return;

    container.innerHTML = `
    <div class="modal-overlay" onclick="cerrarEscanerAsesor(event)">
        <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 480px; text-align: center;">
            <div class="modal-header" style="justify-content:center;position:relative;">
                <h3 class="modal-title" style="margin:0;font-size:17px;font-weight:800;color:var(--text-main);">
                    📷 Escanear Asistencia de Practicante
                </h3>
                <button class="btn-close" onclick="cerrarEscanerAsesor()" style="position:absolute;right:16px;">×</button>
            </div>
            <div class="modal-body" style="padding:18px;">
                <p class="text-muted" style="font-size:12.5px;margin:0 0 14px 0;">
                    Apunta con la cámara al código QR presentado en el teléfono del practicante para validar su asistencia presencial.
                </p>

                <!-- Visor de Cámara -->
                <div id="qr-reader" style="width:100%;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;background:#000;margin-bottom:14px;"></div>
                
                <div id="scannerFeedback" style="display:none;padding:12px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;"></div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                    <div style="font-size:12px;color:#64748b;">
                        Horas a certificar: <strong style="color:#0f172a;">4.0 hrs</strong>
                    </div>
                    <button class="btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="cerrarEscanerAsesor()">
                        Cerrar Escáner
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    iniciarCamaraAsesor();
}

/**
 * Inicializa la cámara utilizando Html5QrcodeScanner
 */
function iniciarCamaraAsesor() {
    if (typeof Html5Qrcode === 'undefined') {
        const fb = document.getElementById('scannerFeedback');
        if (fb) {
            fb.style.display = 'block';
            fb.style.background = '#fef2f2';
            fb.style.color = '#dc2626';
            fb.innerHTML = '⚠️ El módulo de cámara está cargando o no se encuentra disponible. Por favor recarga la página.';
        }
        return;
    }

    _html5QrCodeScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    _html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
            // Código QR detectado con éxito
            await procesarCodigoQrEscaneado(decodedText);
        },
        (errorMessage) => {
            // Parse error normal mientras enfoca
        }
    ).catch(err => {
        const fb = document.getElementById('scannerFeedback');
        if (fb) {
            fb.style.display = 'block';
            fb.style.background = '#fef2f2';
            fb.style.color = '#dc2626';
            fb.innerHTML = '⚠️ No se pudo acceder a la cámara: ' + err;
        }
    });
}

/**
 * Envía el token escaneado al backend para registrar la asistencia
 */
async function procesarCodigoQrEscaneado(qrToken) {
    if (_html5QrCodeScanner) {
        try {
            await _html5QrCodeScanner.pause();
        } catch (_) {}
    }

    const fb = document.getElementById('scannerFeedback');
    if (fb) {
        fb.style.display = 'block';
        fb.style.background = '#eff6ff';
        fb.style.color = '#1d4ed8';
        fb.innerHTML = '⏳ Verificando credenciales y presencia en el servidor...';
    }

    try {
        const res = await fetch(`${API_BASE}/asesor/validar-asistencia-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ qrToken, horas: 4 })
        });
        const d = await res.json();

        if (d.success) {
            cerrarEscanerAsesor();
            await sigpaAlert(
                '¡Asistencia Certificada!',
                `✔ <strong>${d.estudiante}</strong><br>🏫 <strong>${d.institucion}</strong><br>📅 Fecha: ${d.fecha} — Hora: ${d.hora}<br>⏱️ Horas reconocidas: <strong>${d.horas} hrs</strong>`,
                'success'
            );
            loadAsesorView('bitacoras');
        } else {
            if (fb) {
                fb.style.background = '#fef2f2';
                fb.style.color = '#dc2626';
                fb.innerHTML = `❌ ${d.message || 'No fue posible validar la asistencia'}`;
            }
            if (_html5QrCodeScanner) {
                setTimeout(() => {
                    try { _html5QrCodeScanner.resume(); } catch (_) {}
                }, 3000);
            }
        }
    } catch (err) {
        if (fb) {
            fb.style.background = '#fef2f2';
            fb.style.color = '#dc2626';
            fb.innerHTML = `❌ Error de red: ${err.message}`;
        }
        if (_html5QrCodeScanner) {
            setTimeout(() => {
                try { _html5QrCodeScanner.resume(); } catch (_) {}
            }, 3000);
        }
    }
}

/**
 * Detiene la cámara y limpia el modal
 */
function cerrarEscanerAsesor(e) {
    if (e && e.target && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('btn-close')) {
        return;
    }
    if (_html5QrCodeScanner) {
        _html5QrCodeScanner.stop().catch(() => {}).finally(() => {
            _html5QrCodeScanner = null;
            document.getElementById('modalContainer').innerHTML = '';
        });
    } else {
        document.getElementById('modalContainer').innerHTML = '';
    }
}
