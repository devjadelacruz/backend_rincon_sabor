// routes/insumos.js
const express = require('express');
const router = express.Router();

// 👇 ahora usamos el pool/query de MySQL
const { pool, query } = require('../config/connection');

const SP_INSERTAR_INSUMO = 'Proc_InsertarInsumo';
const SP_LISTA_INSUMOS = 'Proc_ListarInsumos';
const SP_ACTUALIZAR_INSUMO = 'Proc_ActualizarInsumo';

// Helper para desempaquetar el resultado de CALL en MySQL
// CALL ... -> [ [ {..}, {..} ], [meta] ]
const unwrapRows = (rows) => {
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// ======================================================
// POST /insumos/agregarInsumo
// ======================================================
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
    return res.status(400).json({
      success: false,
      message: 'Faltan campos.',
    });
  }

  try {
    // Nos aseguramos de enviar números
    const stock = Number(InsumoStockActual);
    const compra = Number(InsumoCompraUnidad);

    await pool.query(
      `CALL ${SP_INSERTAR_INSUMO}(?, ?, ?, ?)`,
      [InsumoNombre, InsumoUnidadMedida, stock, compra]
    );

    return res.status(201).json({
      success: true,
      message: 'Insumo agregado correctamente.',
    });
  } catch (error) {
    console.error('❌ Error al agregar insumo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno.',
    });
  }
});

// ======================================================
// GET /insumos/ListaInsumos
// ======================================================
router.get('/ListaInsumos', async (_req, res) => {
  try {
    const rows = await query(`CALL ${SP_LISTA_INSUMOS}()`);

    const data = unwrapRows(rows) || [];
    console.log(`📦 ListaInsumos -> ${data.length} registros`);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Error al obtener la lista de insumos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener la lista de insumos',
    });
  }
});

// ======================================================
// PUT /insumos/actualizarInsumo
// ======================================================
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
    return res.status(400).json({
      success: false,
      message: 'Faltan campos.',
    });
  }

  try {
    const stock = Number(InsumoStockActual);
    const compra = Number(InsumoCompraUnidad);

    await pool.query(
      `CALL ${SP_ACTUALIZAR_INSUMO}(?, ?, ?, ?, ?)`,
      [
        InsumoCodigo,
        InsumoNombre,
        InsumoUnidadMedida,
        stock,
        compra,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Insumo actualizado correctamente.',
    });
  } catch (error) {
    console.error('❌ Error al actualizar insumo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno.',
    });
  }
});

module.exports = router;
