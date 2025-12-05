// services/prediccionesService.js
const { query } = require('../config/connection');

// Historial de ventas para las predicciones
// (ajustado a tu esquema de MySQL)
const obtenerHistorialVentas = async () => {
  const rows = await query(`
    SELECT
      p.PedidoFechaHora,
      d.detallePedidoMenuCodigo AS MenuCodigo,
      m.MenuPlatos,
      d.detallePedidoCantidad AS CantidadVendida
    FROM pedidos_pedido p
    JOIN pedidos_detallepedido d
      ON d.detallePedidoPedidoCodigo = p.PedidoCodigo
    JOIN pedidos_menu m
      ON m.MenuCodigo = d.detallePedidoMenuCodigo
    WHERE p.PedidoEstado = 'Servido'
  `);

  return rows.map((row) => ({
    PedidoFechaHora: row.PedidoFechaHora,
    MenuCodigo: row.MenuCodigo,
    MenuPlatos: row.MenuPlatos,
    CantidadVendida: row.CantidadVendida,
  }));
};

module.exports = {
  obtenerHistorialVentas,
};
