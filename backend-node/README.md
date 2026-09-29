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
│   │   ├── auth.controller.js       # Autenticación contra USUARIO en Oracle
│   │   ├── director.controller.js   # KPIs, convenios, cupos y asignaciones
│   │   ├── estudiante.controller.js # Bitácoras y avance de horas
│   │   ├── tutor.controller.js      # Transacciones de calificación
│   │   └── asesor.controller.js     # Avales in situ
│   ├── middlewares/
│   │   └── errorHandler.js          # Manejo centralizado de errores HTTP
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── director.routes.js
│   │   ├── estudiante.routes.js
│   │   ├── tutor.routes.js
│   │   └── asesor.routes.js
│   └── app.js                 # Servidor Express y arranque con validación Oracle
├── .env                       # Credenciales activas de Oracle 10g
├── .env.example               # Plantilla de entorno
├── package.json               # Dependencias (oracledb, express, cors, etc.)
└── README.md
```
