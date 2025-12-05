// middlewares/authJwt.js
// Middleware para verificar JWT y helper para firmar tokens.

const jwt = require('jsonwebtoken');

// ⚠️ En producción usa una variable de entorno segura
const JWT_SECRET = process.env.JWT_SECRET || 'mi_super_secreto_rincon_sabor';

/**
 * Middleware que verifica el token JWT.
 * Espera el header: Authorization: Bearer <token>
 */
function authJwt(req, res, next) {
  // Leer header Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado',
    });
  }

  // Verificar token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Error verificando token:', err);
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
      });
    }

    // Guardamos los datos del usuario (rol, código, email, etc.)
    req.user = decoded;
    next();
  });
}

/**
 * Helper para generar un token JWT.
 * @param {Object} payload - { id, email, rol, nombre, ... }
 * @returns {string} token firmado
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

module.exports = {
  authJwt,
  signToken,
  JWT_SECRET,
};
