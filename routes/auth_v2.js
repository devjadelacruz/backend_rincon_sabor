// routes/auth_v2.js
// Login v2 basado SOLO en email (pensado para integrarse con Google Sign-In)
// Devuelve el rol (admin / cocinero / mesero) y un token JWT simple.

const express = require('express');
const router = express.Router();

const { query } = require('../config/connection'); // helper de MySQL
const { signToken } = require('../middlewares/authJwt');

// POST /api/v2/login
router.post('/login', async (req, res) => {
  try {
    console.log('📥 /api/v2/login body recibido:', req.body);

    const { email } = req.body;

    // 1) Validar que venga el email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Debe enviar el campo "email" en el body JSON.',
      });
    }
    
// 👇 DEBUG: ver si el backend realmente ve dbo_usuarios
const debugTables = await query('SHOW TABLES LIKE "dbo_usuarios"');
console.log('🔍 Tablas que coinciden con dbo_usuarios (desde Node):', debugTables);



    // 2) Buscar usuario por email
    const sql = `
      SELECT 
        UsuarioCodigo,
        UsuarioNombre,
        UsuarioEmail,
        UsuarioRol,
        UsuarioEstado
      FROM dbo_usuarios
      WHERE UsuarioEmail = ?
      LIMIT 1
    `;

    const rows = await query(sql, [email]);
    console.log('🔎 Resultado consulta usuario:', rows);

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado con ese email.',
      });
    }

    const user = rows[0];

    // 3) Validar que el usuario esté activo
    if (user.UsuarioEstado !== 'A') {
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo.',
      });
    }

    // 4) Armar payload del token
    const payload = {
      id: user.UsuarioCodigo,
      email: user.UsuarioEmail,
      rol: user.UsuarioRol,
      nombre: user.UsuarioNombre,
    };

    // 5) Firmar token (8 horas)
    const token = signToken(payload);

    // 6) Responder OK
    return res.json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario: {
        codigo: user.UsuarioCodigo,
        nombre: user.UsuarioNombre,
        email: user.UsuarioEmail,
        rol: user.UsuarioRol,
      },
    });
  } catch (err) {
    console.error('❌ Error en /api/v2/login:', err);
    return res.status(500).json({
      success: false,
      message: 'Error interno en login',
    });
  }
});

module.exports = router;
