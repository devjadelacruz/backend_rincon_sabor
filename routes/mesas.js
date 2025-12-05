// routes/mesas.js
const express = require('express');
const router = express.Router();

const { query } = require('../config/connection');
const { emitirActualizacionMesas } = require('../sockets/mesasSocket');

// Nombres de los procedimientos almacenados en MySQL
const SP_OBTENER_MESAS = 'Proc_ObtenerMesas';
const SP_CAMBIAR_ESTADO_MESA = 'Proc_CambiarEstadoMesa';

// Helper para desempaquetar resultados de CALL en MySQL
const unwrapRows = (rows) => {
  // CALL retorna algo tipo [ [ {..}, {..} ], [meta] ]
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// ===============================
// GET /mesas/obtener
// ===============================
router.get('/obtener', async (req, res) => {
  try {
    const rows = await query(`CALL ${SP_OBTENER_MESAS}()`);
    const data = unwrapRows(rows);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error al obtener las mesas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener las mesas',
    });
  }
});

// ===============================
// PUT /mesas/actualizar
// ===============================
router.put('/actualizar', async (req, res) => {
  try {
    const { MesaCodigo, nuevoEstado } = req.body;

    if (!MesaCodigo || !nuevoEstado) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros incompletos',
      });
    }

    // ✅ CORRECCIÓN: Convertir a formato con mayúscula inicial
    // La BD espera: 'Disponible', 'Ocupada', 'Esperando', 'Mantenimiento', 'Reservado'
    
    const key = String(nuevoEstado).toLowerCase().trim();
    
    // Mapeo de estados del frontend al formato de la BD (mayúscula inicial)
    const estadoMap = {
      'disponible': 'Disponible',
      'ocupada': 'Ocupada',
      'esperando': 'Esperando',
      'mantenimiento': 'Mantenimiento',
      'reservado': 'Reservado',
    };
    
    const estadoDB = estadoMap[key];
    
    if (!estadoDB) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido: ${nuevoEstado}. Valores permitidos: disponible, ocupada, esperando, mantenimiento, reservado`,
      });
    }

    console.log(
      `📦 Body recibido en /mesas/actualizar:`,
      req.body
    );
    console.log(
      `🔄 Cambiando estado de mesa ${MesaCodigo} de "${nuevoEstado}" a "${estadoDB}"`
    );

    // Enviar el estado con mayúscula inicial
    await query(`CALL ${SP_CAMBIAR_ESTADO_MESA}(?, ?)`, [
      MesaCodigo,
      estadoDB, // ✅ Envía 'Esperando', no 'esperando'
    ]);

    // 🔊 Avisar por sockets a los clientes
    emitirActualizacionMesas();

    res.status(200).json({
      success: true,
      message: 'Estado actualizado correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar estado de mesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor',
      error: error.message,
    });
  }
}); 

// ===============================
// POST /mesas/actualizar (compatibilidad)
// ===============================
router.post('/actualizar', async (req, res) => {
  // Redirige al método PUT
  return router.handle({ 
    method: 'PUT', 
    url: '/actualizar', 
    body: req.body,
    headers: req.headers 
  }, res);
});

module.exports = router;  