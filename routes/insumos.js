// routes/insumos.js
const express = require('express');
const { query } = require('../config/connection');

const SP_INSERTAR_INSUMO   = 'Proc_InsertarInsumo';
const SP_LISTA_INSUMOS     = 'Proc_ListarInsumos';
const SP_ACTUALIZAR_INSUMO = 'Proc_ActualizarInsumo';

const router = express.Router();

// Helper para desempaquetar resultados de CALL en MySQL
// CALL ... → [ [ {..}, {..} ], [meta] ]
const unwrapRows = (rows) => {
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// =====================================================
// POST /insumos/agregarInsumo
// =====================================================
router.post('/agregarInsumo', async (req, res) => {
  const {
    InsumoNombre,
    InsumoUnidadMedida,
    InsumoStockActual,
    InsumoCompraUnidad,
  } = req.body;

  if (
    !InsumoNombre ||
    !InsumoUnidadMedida ||
    InsumoStockActual == null ||
    InsumoCompraUnidad == null
  ) {
    return res
      .status(400)
      .json({ success: false, message: 'Faltan campos.' });
  }

  try {
    // Proc_InsertarInsumo(
    //   pInsumoNombre, pInsumoUnidadMedida, pInsumoStockActual, pInsumoCompraUnidad
    // )
    await query(
      `CALL ${SP_INSERTAR_INSUMO}(?, ?, ?, ?)`,
      [
        InsumoNombre,
        InsumoUnidadMedida,
        InsumoStockActual,
        InsumoCompraUnidad,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Insumo agregado correctamente.',
    });
  } catch (error) {
    console.error('Error al agregar insumo:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error interno.' });
  }
});

// =====================================================
// GET /insumos/ListaInsumos
// =====================================================
router.get('/ListaInsumos', async (req, res) => {
  try {
    // Si tienes el SP Proc_ListarInsumos en MySQL:
    const rows = await query(`CALL ${SP_LISTA_INSUMOS}()`);
    const data = unwrapRows(rows);

    // Si NO tuvieras el SP, alternativa:
    // const data = await query('SELECT * FROM dbo_Insumos');

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error al obtener la lista de insumos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener la lista de insumos',
    });
  }
});

// =====================================================
// PUT /insumos/actualizarInsumo
// =====================================================
router.put('/actualizarInsumo', async (req, res) => {
  const {
    InsumoCodigo,
    InsumoNombre,
    InsumoUnidadMedida,
    InsumoStockActual,
    InsumoCompraUnidad,
  } = req.body;

  if (
    !InsumoCodigo ||
    !InsumoNombre ||
    !InsumoUnidadMedida ||
    InsumoStockActual == null ||
    InsumoCompraUnidad == null
  ) {
    return res
      .status(400)
      .json({ success: false, message: 'Faltan campos.' });
  }

  try {
    // Proc_ActualizarInsumo(
    //   pInsumoCodigo, pInsumoNombre, pUnidadMedida, pStockActual, pCompraUnidad
    // )
    await query(
      `CALL ${SP_ACTUALIZAR_INSUMO}(?, ?, ?, ?, ?)`,
      [
        InsumoCodigo,
        InsumoNombre,
        InsumoUnidadMedida,
        InsumoStockActual,
        InsumoCompraUnidad,
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Insumo actualizado correctamente.',
    });
  } catch (error) {
    console.error('Error al actualizar insumo:', error);
    res.status(500).json({ success: false, message: 'Error interno.' });
  }
});

module.exports = router;
