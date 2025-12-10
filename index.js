// index.js
// Punto central de configuración de la app Express (sin levantar el servidor).
// Aquí se registran middlewares globales y todas las rutas (v1 y v2 simples).

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// ===============================
// Routers "clásicos" (v1)
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
// Routers V2 (solo login)
// ===============================
const authV2Routes = require('./routes/auth_v2');

// 👇 IMPORTANTE: ya NO importamos middlewares de JWT ni roles
// const { authJwt } = require('./middlewares/authJwt');
// const { requireRole } = require('./middlewares/requireRole');

// Crear instancia de la app Express
const app = express();

// ===============================
// Middlewares globales
// ===============================
app.use(helmet());                               // Cabeceras de seguridad básicas
app.use(cors());                                 // Permitir CORS (Flutter, web, etc.)
app.use(express.urlencoded({ extended: true })); // Soporte para x-www-form-urlencoded
app.use(express.json());                         // Parseo de JSON en el body

// =====================================================
//  RUTAS ORIGINALES (v1) – SIN JWT
// =====================================================
app.use('/mesas', mesasRouter);
app.use('/usuarios', usuariosRouter);
app.use('/categorias', categoriasRouter);
app.use('/insumos', insumosRouter);
app.use('/menu', menuRouter);

// 👇 AHORA /pedidos NO TIENE authJwt (se desactiva validación de token)
app.use('/pedidos', pedidosRouter);

app.use('/dataGraficos', dataGraficos);
app.use('/predicciones', prediccionesRouter);

// =====================================================
//  RUTAS V2 DE AUTENTICACIÓN (solo login)
// =====================================================
app.use('/api/v2', authV2Routes);

// No montamos /api/v2/test ni rutas por rol

// Exportar la app para que server.js la use
module.exports = app;
