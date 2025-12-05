// index.js
// Punto central de configuración de la app Express (sin levantar el servidor).
// Aquí se registran middlewares globales y todas las rutas (v1 y v2).

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// ===============================
// Routers "clásicos" (sin JWT)
// ===============================
const mesasRouter = require('./routes/mesas');
const usuariosRouter = require('./routes/usuarios');
const categoriasRouter = require('./routes/categorias');
const insumosRouter = require('./routes/insumos');
const menuRouter = require('./routes/menu');
const pedidosRouter = require('./routes/pedidos');
const dataGraficos = require('./routes/dataGraficos');
const prediccionesRouter = require('./routes/predicciones');

// ===============================
// Routers V2 (login + pruebas)
// ===============================
const authV2Routes = require('./routes/auth_v2');
const rolesTestV2Routes = require('./routes/roles_test_v2');

// ===============================
// Middlewares de auth / roles V2
// ===============================
const { authJwt } = require('./middlewares/authJwt');
const { requireRole } = require('./middlewares/requireRole');

// Crear instancia de la app Express
const app = express();

// ===============================
// Middlewares globales
// ===============================
app.use(helmet());                         // Cabeceras de seguridad básicas
app.use(cors());                           // Permitir CORS (Flutter, web, etc.)
app.use(express.urlencoded({ extended: true })); // Soporte para x-www-form-urlencoded
app.use(express.json());                   // Parseo de JSON en el body

// =====================================================
//  RUTAS ORIGINALES (v1) – SIN JWT
//  Siguen funcionando igual que antes.
//  Ej: GET /pedidos/activos, POST /mesas, etc.
// =====================================================
app.use('/mesas', mesasRouter);
app.use('/usuarios', usuariosRouter);
app.use('/categorias', categoriasRouter);
app.use('/insumos', insumosRouter);
app.use('/menu', menuRouter);
app.use('/pedidos', pedidosRouter);
app.use('/dataGraficos', dataGraficos);
app.use('/predicciones', prediccionesRouter);

// =====================================================
//  RUTAS V2 DE AUTENTICACIÓN Y PRUEBAS
// =====================================================

// Login v2 por email (pensado para integrarse con Google Sign-In)
app.use('/api/v2', authV2Routes);

// Endpoints de prueba de roles (opcional, solo para debug)
app.use('/api/v2/test', rolesTestV2Routes);

// =====================================================
//  RUTAS NUEVAS V2 PROTEGIDAS POR ROL
//  Aquí "encapsulamos" el router de pedidos bajo
//  prefijos distintos para MESERO y COCINERO.
//  Internamente usan EXÁCTAMENTE la misma lógica
//  que /pedidos, pero ahora exigen JWT + rol.
// =====================================================

// 👉 Rutas para MESERO (y opcionalmente admin)
//    Ejemplo real de endpoint: GET /api/v2/mesero/pedidos/activos
app.use(
  '/api/v2/mesero/pedidos',
  authJwt,                         // exige token válido (Authorization: Bearer <token>)
  requireRole(['mesero', 'admin']),// solo mesero o admin
  pedidosRouter                    // reutilizamos toda la lógica de routes/pedidos.js
);

// 👉 Rutas para COCINERO (y opcionalmente admin)
//    Ejemplo real de endpoint: GET /api/v2/cocina/pedidos/activos
app.use(
  '/api/v2/cocina/pedidos',
  authJwt,
  requireRole(['cocinero', 'admin']),
  pedidosRouter
);

// Exportar la app para que server.js la use
module.exports = app;
