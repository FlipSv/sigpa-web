# SIGPA — Backend Node.js (Oracle Database 10g)

Backend en **Node.js (Express)** conectado **exclusivamente a Oracle Database 10g**.
Implementa una arquitectura limpia con **Connection Pooling (`oracledb`)** y política **Fail-Fast**.

---

## 🚀 Requisitos e Instalación

### 1. Variables de Entorno (`.env`)
Configura tus credenciales de Oracle 10g en el archivo `.env`:

```env
PORT=8081
DB_USER=SCOTT
DB_PASSWORD=tu_contraseña_aqui
DB_CONNECT_STRING=localhost:1521/XE
```

> **Política Fail-Fast:** Si el servicio de Oracle 10g no está activo o las credenciales no son válidas al arrancar, el servidor emitirá un error detallado y se detendrá inmediatamente (`process.exit(1)`).

### 2. Inicializar / Verificar Tablas DDL en Oracle
Crea las tablas en tu esquema de Oracle 10g si aún no están creadas:
```bash
npm run setup-db
```

### 3. Iniciar Servidor en Modo Desarrollo
```bash
npm run dev
```

O en modo normal/producción:
```bash
npm start
```

---

## 🌐 URLs del Sistema
- **Aplicación Web (Frontend):** `http://localhost:8081`
- **Endpoints API REST:** `http://localhost:8081/api`
- **Diagnóstico y Versión de Oracle:** `http://localhost:8081/api/test-db`

---

## 📁 Estructura del Backend

```
backend-node/
├── src/
│   ├── config/
│   │   ├── database.js        # Pool oracledb, executeQuery y Fail-Fast
│   │   └── setup.js           # DDLs y verificación en Oracle 10g
│   ├── controllers/
│   │   ├── auth.controller.js       # Autenticación con Bcrypt y emisión de JWT
│   │   ├── director.controller.js   # KPIs, convenios, cupos y creación de usuarios con hash
│   │   ├── estudiante.controller.js # Bitácoras y avance de horas
│   │   ├── tutor.controller.js      # Transacciones de calificación
│   │   └── asesor.controller.js     # Avales in situ
│   ├── middlewares/
│   │   ├── auth.middleware.js       # verificarToken (JWT Bearer) y verificarRol ([roles])
│   │   └── errorHandler.js          # Manejo centralizado de errores HTTP
│   ├── routes/
│   │   ├── auth.routes.js           # /api/login, /api/perfil
│   │   ├── director.routes.js       # Rutas protegidas (DIRECTOR)
│   │   ├── estudiante.routes.js     # Rutas protegidas (ESTUDIANTE / Roles autorizados)
│   │   ├── tutor.routes.js          # Rutas protegidas (TUTOR / COORDINADOR)
│   │   └── asesor.routes.js         # Rutas protegidas (ASESOR)
│   └── app.js                 # Servidor Express y arranque con validación Oracle
├── .env                       # Variables de entorno y JWT_SECRET
├── .env.example               # Plantilla de entorno
├── test_api.js                # Suite de pruebas de integración con Oracle 10g
├── test_auth_unit.js          # Suite de pruebas unitarias de seguridad (Bcrypt + JWT)
├── package.json               # Dependencias (bcryptjs, jsonwebtoken, oracledb, etc.)
└── README.md
```

---

## 🔒 Arquitectura de Seguridad Implementada

### A. Cifrado Unidireccional de Contraseñas (Bcrypt)
- Las contraseñas en la tabla `USUARIO` nunca se almacenan en texto plano.
- Al registrar usuarios (ej. `POST /api/director/nuevo_usuario`), la contraseña se procesa con `bcrypt.hash(contrasena, 10)` generando un hash seguro de 60 caracteres.
- Al iniciar sesión (`POST /api/login`), se valida con `bcrypt.compare(contrasena, hashAlmacenado)`.
- **Auto-migración transparente:** Si existen cuentas históricas con contraseñas en texto plano, el sistema valida la credencial y actualiza automáticamente su registro en Oracle a un hash bcrypt en su primer inicio de sesión.
- Se amplió la columna en Oracle a `VARCHAR2(255)` para garantizar almacenamiento seguro sin truncamientos.

### B. Tokens de Sesión (JWT) y Control de Acceso por Roles (RBAC)
- **Generación de Token:** Tras validar credenciales exitosamente, el servidor emite un JSON Web Token firmado con clave secreta (`JWT_SECRET`) y vigencia configurable (`JWT_EXPIRES_IN=8h`), con el payload `{ id, nombre, email, rol }`.
- **Almacenamiento Cliente:** El frontend almacena el token en `sessionStorage` y `localStorage` (`sigpa_token`).
- **Interceptor HTTP:** En el frontend (`frontend/js/app.js`), un interceptor inyecta automáticamente la cabecera `Authorization: Bearer <token>` en todas las llamadas a la API y redirige automáticamente al login (`index.html?session_expired=1`) si el token expira o devuelve HTTP 401.
- **Middlewares de Protección:**
  - `verificarToken`: Valida la presencia y autenticidad del token Bearer.
  - `verificarRol(roles)`: Comprueba si el rol del usuario autenticado pertenece a los roles permitidos (ej. `DIRECTOR`, `ESTUDIANTE`, `TUTOR`), denegando accesos no autorizados con código HTTP 403 Forbidden.

