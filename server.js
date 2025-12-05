// server.js

// ============================================================
// 1. Carga de variables de entorno (.env)
// ============================================================
require('dotenv').config();

// ============================================================
// 2. Dependencias base de Node.js / HTTP
// ============================================================
const http = require('http');

// ============================================================
// 3. App principal de Express
//    - En ./index se configura Express, middlewares, rutas v1, etc.
// ============================================================
const app = require('./index');

// ============================================================
// 4. Sockets del sistema
//    - Mesas (estado de mesas en tiempo real)
//    - Menú (disponibilidad de productos, etc.)
//    - Pedidos (actualización de pedidos en cocina/mesero)
// ============================================================
const { configurarSockets } = require('./sockets/mesasSocket');
const { configurarMenuSockets } = require('./sockets/menuSocket');
const { initSocket: initPedidosSocket } = require('./sockets/pedidosSocket');

// ============================================================
// 5. Socket.IO para WebSockets
// ============================================================
const { Server } = require('socket.io');

// ============================================================
// 6. Puerto de ejecución del servidor HTTP
//    - Usa process.env.PORT si está definido
//    - Caso contrario, 8080 por defecto
// ============================================================
/**
 * Puerto en el que se ejecuta el servidor.
 *
 * Se asigna a la variable PORT el valor de la variable de entorno process.env.PORT si está definida;
 * de lo contrario, se utiliza el puerto 8080.
 *
 * @constant {number|string} PORT - Puerto configurado para el servidor.
 */
const PORT = process.env.PORT || 8080;

// ============================================================
// 7. Creación del servidor HTTP a partir de la app de Express
//    - Este servidor atenderá todas las peticiones REST
// ============================================================
/**
 * Esta instancia del servidor se crea utilizando http.createServer de Node.js y es responsable de manejar
 * las solicitudes HTTP entrantes y enviar las respuestas. La lógica de rutas se define en la app de Express.
 */
const server = http.createServer(app);

// ============================================================
// 8. Servidor WebSocket (Socket.IO)
//    - Permite comunicación en tiempo real con el frontend (mesas, pedidos, etc.)
// ============================================================
const io = new Server(server, {
  cors: {
    origin: '*', // En producción conviene restringir a tu dominio
  },
});

// ============================================================
// 9. Configuración de los distintos canales de WebSocket
// ============================================================

// 🔹 Sockets para el módulo de mesas (mesasSocket.js)
configurarSockets(io);

// 🔹 Sockets para el módulo de pedidos (pedidosSocket.js)
initPedidosSocket(io);

// 🔹 (Opcional) Sockets para el menú, si los usas en tu proyecto
// configurarMenuSockets(io); // descomenta si ya tienes este flujo activo


// ============================================================
// 10. Rutas nuevas de autenticación v2 (login con roles)
//     - NO rompen nada del login actual
//     - Se montan bajo el prefijo /api/v2
//     - Ejemplo de uso: POST /api/v2/login
// ============================================================

// Importamos el router de autenticación v2
//   → Este archivo define el login que valida contra dbo_usuarios
//     y devuelve token + rol (admin, cocinero, mesero).
const authV2Routes = require('./routes/auth_v2');

// Montamos todas las rutas de auth_v2 bajo el prefijo /api/v2
// De esta forma, el backend actual sigue funcionando igual,
// y el nuevo flujo de login se puede consumir desde el frontend
// sin tocar el código existente.
app.use('/api/v2', authV2Routes);


// ============================================================
// 10.1 Ruta raíz simple (salud de la API)
//     Solo para verificar que el backend está vivo.
// ============================================================
app.get('/', (req, res) => {
  res.send('API Rincón Sabor backend OK');
});



// ============================================================
// 11. Arranque del servidor HTTP + WebSocket
// ============================================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡️Servidor corriendo en el puerto ${PORT}`);
});
