    // routes/roles_test_v2.js
// Rutas de PRUEBA para verificar que el JWT y los roles funcionan correctamente.

const express = require('express');
const router = express.Router();

const { authJwt } = require('../middlewares/authJwt');
const { requireRole } = require('../middlewares/requireRole');

/**
 * GET /api/v2/test/profile
 * Solo verifica que el token sea válido.
 * Muestra el payload decodificado (id, email, rol, iat, exp).
 */
router.get('/profile', authJwt, (req, res) => {
  return res.json({
    success: true,
    message: 'Token válido',
    user: req.user,        // viene del middleware authJwt
  });
});

/**
 * GET /api/v2/test/solo-mesero
 * Solo puede entrar un usuario con rol "mesero".
 */
router.get('/solo-mesero', authJwt, requireRole('mesero'), (req, res) => {
  return res.json({
    success: true,
    message: 'Acceso permitido solo a MESERO',
    user: req.user,
  });
});

/**
 * GET /api/v2/test/solo-cocinero
 * Solo puede entrar un usuario con rol "cocinero".
 */
router.get('/solo-cocinero', authJwt, requireRole('cocinero'), (req, res) => {
  return res.json({
    success: true,
    message: 'Acceso permitido solo a COCINERO',
    user: req.user,
  });
});

/**
 * GET /api/v2/test/solo-admin
 * Ejemplo para futuro: solo admins.
 */
router.get('/solo-admin', authJwt, requireRole('admin'), (req, res) => {
  return res.json({
    success: true,
    message: 'Acceso permitido solo a ADMIN',
    user: req.user,
  });
});

module.exports = router;
