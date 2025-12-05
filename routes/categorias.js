// routes/categorias.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/connection'); // 👈 MySQL

const SP_MOSTRAR_CATEGORIA    = 'Proc_MostrarCategorias';
const SP_INSERTAR_CATEGORIA   = 'Proc_AgregarCategoria';
const SP_ACTUALIZAR_CATEGORIA = 'Proc_ActualizarCategorias';
const SP_ELIMINAR_CATEGORIA   = 'Proc_EliminarCategoria';

const unwrapRows = (rows) => {
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// 🔹 MOSTRAR CATEGORÍAS (para el mesero / panel)
router.get('/mostrarCategorias', async (req, res) => {
  try {
    // 👇 AQUÍ VA EL PARÁMETRO QUE PIDE EL SP
    // Usa 'A' para solo activas, cámbialo si tu SP espera otra cosa
    const estado = 'A';

    const rows = await query(
      `CALL ${SP_MOSTRAR_CATEGORIA}(?)`,
      [estado]
    );
    const result = unwrapRows(rows);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error al obtener las categorias 🏸:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener las categorías'
    });
  }
});

router.post('/agregarCategoria', async (req, res) => {
  try {
    const { CategoriaNombre, CategoriaDescripcion, CategoriaEstado } = req.body;

    if (!CategoriaNombre || !CategoriaDescripcion) {
      return res.status(400).json({
        success: false,
        message: 'Los campos CategoriaNombre y CategoriaDescripcion son obligatorios.'
      });
    }

    await query(
      `CALL ${SP_INSERTAR_CATEGORIA}(?, ?, ?)`,
      [
        CategoriaNombre,
        CategoriaDescripcion,
        CategoriaEstado || 'A'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Categoría agregada correctamente.'
    });
  } catch (error) {
    console.error('Error al agregar la categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al agregar la categoría.'
    });
  }
});

router.put('/actualizarCategoria', async (req, res) => {
  try {
    const { CategoriaCodigo, CategoriaNombre, CategoriaDescripcion, CategoriaEstado } = req.body;

    if (!CategoriaCodigo || !CategoriaNombre || !CategoriaDescripcion || !CategoriaEstado) {
      return res.status(400).json({
        success: false,
        message:
          'Todos los campos son obligatorios: CategoriaCodigo, CategoriaNombre, CategoriaDescripcion, CategoriaEstado.'
      });
    }

    await query(
      `CALL ${SP_ACTUALIZAR_CATEGORIA}(?, ?, ?, ?)`,
      [
        CategoriaCodigo,
        CategoriaNombre,
        CategoriaDescripcion,
        CategoriaEstado
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Categoría actualizada correctamente.'
    });
  } catch (error) {
    console.error('Error al actualizar la categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar la categoría.'
    });
  }
});

router.delete('/eliminarCategoria/:CategoriaCodigo', async (req, res) => {
  try {
    const { CategoriaCodigo } = req.params;

    if (!CategoriaCodigo) {
      return res.status(400).json({
        success: false,
        message: 'El código de la categoría es obligatorio.'
      });
    }

    await query(
      `CALL ${SP_ELIMINAR_CATEGORIA}(?)`,
      [CategoriaCodigo]
    );

    res.status(200).json({
      success: true,
      message: 'Categoría eliminada correctamente.'
    });
  } catch (error) {
    console.error('Error al eliminar la categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al eliminar la categoría.'
    });
  }
});

module.exports = router;
