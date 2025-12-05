// routes/usuarios.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { query } = require('../config/connection'); // 👈 usamos MySQL ahora

const SP_OBTENER_USUARIO_POR_CORREO = 'Proc_ObtenerUsuarioPorCorreo';
const SP_LISTAR_USUARIOS = 'Proc_ListarUsuarios';
const SP_ACTUALIZAR_ESTADO_USUARIO = 'Proc_CambiarEstadoUsuario';
const SP_ELIMINAR_USUARIO = 'Proc_EliminarUsuario';
const SP_INSERTAR_USUARIO = 'Proc_CrearUsuario';
const SP_ACTUALIZAR_USUARIO = 'Proc_ActualizarUsuario';

// Helper para desempaquetar resultados de CALL en MySQL
const unwrapRows = (rows) => {
  // Para CALL algo así: [ [ {..}, {..} ], [meta] ]
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// ===============================
// GET /infoUser  (requiere token)
// ===============================
router.get('/infoUser', verifyToken, async (req, res) => {
  const correo = req.user?.email; // Extraemos el correo del token

  if (!correo) {
    return res.status(400).json({
      success: false,
      message: 'Correo es requerido'
    });
  }

  try {
    // CALL Proc_ObtenerUsuarioPorCorreo(@correo)
    const rows = await query(`CALL ${SP_OBTENER_USUARIO_POR_CORREO}(?)`, [correo]);
    const result = unwrapRows(rows);

    if (result.length > 0) {
      const usuario = result[0];
      return res.json({
        success: true,
        data: usuario
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
  } catch (error) {
    console.error('Error en /infoUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los datos del usuario'
    });
  }
});

// ===============================
// GET /listarUsuarios
// ===============================
router.get('/listarUsuarios', async (req, res) => {
  try {
    // CALL Proc_ListarUsuarios()
    const rows = await query(`CALL ${SP_LISTAR_USUARIOS}()`); 
    const result = unwrapRows(rows);

    if (result.length > 0) {
      return res.json({
        success: true,
        data: result
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron usuarios'
      });
    }
  } catch (error) {
    console.error('Error en /listarUsuarios:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar los usuarios'
    });
  }
});

// ===============================
// PUT /actualizarEstado  (requiere token)
// ===============================
router.put('/actualizarEstado', verifyToken, async (req, res) => {
  const { usuarioCodigo, nuevoEstado } = req.body;

  if (!usuarioCodigo || !nuevoEstado) {
    return res.status(400).json({
      success: false,
      message: 'usuarioCodigo y nuevoEstado son requeridos'
    });
  }

  if (!['A', 'I'].includes(nuevoEstado)) {
    return res.status(400).json({
      success: false,
      message: "nuevoEstado debe ser 'A' (activo) o 'I' (inactivo)"
    });
  }

  try {
    // CALL Proc_CambiarEstadoUsuario(@UsuarioCodigo, @NuevoEstado)
    await query(`CALL ${SP_ACTUALIZAR_ESTADO_USUARIO}(?, ?)`, [
      usuarioCodigo,
      nuevoEstado
    ]);

    return res.json({
      success: true,
      message: `Estado actualizado a '${nuevoEstado === 'A' ? 'Activo' : 'Inactivo'}'`
    });
  } catch (error) {
    console.error('Error en /actualizarEstado:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado del usuario',
      error: error.message
    });
  }
});

// ===============================
// DELETE /eliminar/:codigo  (requiere token)
// ===============================
router.delete('/eliminar/:codigo', verifyToken, async (req, res) => {
  const { codigo } = req.params;

  if (!codigo) {
    return res.status(400).json({
      success: false,
      message: 'El código del usuario es requerido'
    });
  }

  try {
    // CALL Proc_EliminarUsuario(@Codigo)
    await query(`CALL ${SP_ELIMINAR_USUARIO}(?)`, [codigo]);

    return res.json({
      success: true,
      message: `Usuario con código '${codigo}' eliminado correctamente`
    });
  } catch (error) {
    console.error('Error en /eliminar/:codigo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar el usuario',
      error: error.message
    });
  }
});

// ===============================
// POST /crear
// ===============================
router.post('/crear', async (req, res) => {
  const {
    UsuarioNombre,
    UsuarioEmail,
    UsuarioDireccion,
    UsuarioTelefono,
    UsuarioRol
  } = req.body;

  if (!UsuarioNombre || !UsuarioEmail || !UsuarioDireccion || !UsuarioTelefono || !UsuarioRol) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos son requeridos'
    });
  }

  try {
    // CALL Proc_CrearUsuario(@UsuarioNombre, @UsuarioEmail, @UsuarioDireccion, @UsuarioTelefono, @UsuarioRol)
    await query(`CALL ${SP_INSERTAR_USUARIO}(?, ?, ?, ?, ?)`, [
      UsuarioNombre,
      UsuarioEmail,
      UsuarioDireccion,
      UsuarioTelefono,
      UsuarioRol
    ]);

    return res.json({
      success: true,
      message: 'Usuario creado correctamente'
    });
  } catch (error) {
    console.error('Error en /crear:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear el usuario',
      error: error.message
    });
  }
});

// ===============================
// PUT /actualizarUsuario  (requiere token)
// ===============================
router.put('/actualizarUsuario', verifyToken, async (req, res) => {
  const {
    UsuarioCodigo,
    UsuarioNombre,
    UsuarioEmail,
    UsuarioDireccion,
    UsuarioTelefono,
    UsuarioEstado,
    UsuarioRol
  } = req.body;

  if (
    !UsuarioCodigo ||
    !UsuarioNombre ||
    !UsuarioEmail ||
    !UsuarioDireccion ||
    !UsuarioTelefono ||
    !UsuarioEstado ||
    !UsuarioRol
  ) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos son requeridos'
    });
  }

  try {
    // CALL Proc_ActualizarUsuario(@UsuarioCodigo, @UsuarioNombre, @UsuarioEmail, @UsuarioDireccion, @UsuarioTelefono, @UsuarioEstado, @UsuarioRol)
    await query(`CALL ${SP_ACTUALIZAR_USUARIO}(?, ?, ?, ?, ?, ?, ?)`, [
      UsuarioCodigo,
      UsuarioNombre,
      UsuarioEmail,
      UsuarioDireccion,
      UsuarioTelefono,
      UsuarioEstado,
      UsuarioRol
    ]);

    return res.json({
      success: true,
      message: 'Usuario actualizado correctamente'
    });
  } catch (error) {
    console.error('Error en /actualizarUsuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el usuario',
      error: error.message
    });
  }
});

module.exports = router;
