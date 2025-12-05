// middlewares/requireRole.js
// Middleware para restringir acceso por rol (admin, cocinero, mesero, etc.).

/**
 * Crea un middleware que solo permite pasar a ciertos roles.
 *
 * Ejemplos:
 *   requireRole('admin')
 *   requireRole(['admin', 'cocinero'])
 */
function requireRole(rolesPermitidos = []) {
  // Aceptar string o array
  const roles = Array.isArray(rolesPermitidos)
    ? rolesPermitidos
    : [rolesPermitidos];

  return (req, res, next) => {
    const rol = req.user?.rol; // viene del token (authJwt)

    if (!rol || !roles.includes(rol)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: rol no autorizado',
      });
    }

    next();
  };
}

module.exports = { requireRole };
