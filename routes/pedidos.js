// routes/pedido.js

const express = require('express');
const router = express.Router();

const { pool, query } = require('../config/connection');
const { emitirActualizacionMesas } = require('../sockets/mesasSocket');
const { emitirActualizacionPedidos } = require('../sockets/pedidosSocket');

// Nombres de SP en MySQL (sin esquema "Pedidos.")
const SP_ACTUALIZAR_DETALLES = 'Proc_ActualizarDetallesPedido';
const SP_OBTENER_PEDIDOS_POR_MESA = 'Proc_ObtenerPedidoPorMesa';
const SP_CREAR_PEDIDO = 'Proc_CrearPedido';
const SP_PROCESAR_MENU = 'Proc_ProcesarMenu';
const SP_ELIMINAR_PEDIDO = 'Proc_EliminarPedidoPorCodigo';
const SP_DEVOLVER_STOCK_MENU = 'Proc_DevolverStockMenu';

const SP_CAMBIAR_ESTADO_MESA = 'Proc_CambiarEstadoMesa';
const SP_FINALIZAR_PEDIDO = 'Proc_FinalizarPedido';
const SP_OBTENER_PEDIDOS_ACTIVOS = 'Proc_ObtenerTodosLosPedidos';
const SP_ACTUALIZAR_ESTADO_PEDIDO = 'Proc_ActualizarEstadoPedido';
const SP_OBTENER_TODOS_LOS_PEDIDOS = 'Proc_ObtenerTodosLosPedidos';
const SP_ACTUALIZAR_ESTADO_DETALLE = 'Proc_ActualizarEstadoDetallePedido';

// Helper para desempaquetar resultados de CALL en MySQL
const unwrapRows = (rows) => {
  // CALL ... → [ [ {..}, {..} ], [meta] ]
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// ============================================================
// GET /pedido/obtenerPorMesas/:MesaCodigo
// ============================================================
router.get('/obtenerPorMesas/:MesaCodigo', async (req, res) => {
  try {
    const { MesaCodigo } = req.params;

    // CALL Proc_ObtenerPedidoPorMesa(@MesaCodigo)
    const rows = await query(`CALL ${SP_OBTENER_PEDIDOS_POR_MESA}(?)`, [MesaCodigo]);
    const pedidosRaw = unwrapRows(rows) || [];

    // Si no hay pedidos para esa mesa → la dejamos Disponible
    if (pedidosRaw.length === 0) {
      await query(`CALL ${SP_CAMBIAR_ESTADO_MESA}(?, ?)`, [MesaCodigo, 'Disponible']);
      emitirActualizacionMesas();
    }

    const pedidosMap = new Map();

    pedidosRaw.forEach(row => {
      const key = row.PedidoCodigo;
      if (!pedidosMap.has(key)) {
        pedidosMap.set(key, {
          PedidoCodigo: row.PedidoCodigo,
          PedidoFechaHora: row.PedidoFechaHora,
          PedidoTotal: row.PedidoTotal,
          PedidoEstado: row.PedidoEstado,
          Detalles: []
        });
      }

      pedidosMap.get(key).Detalles.push({
        DetallePedidoCodigo: row.detallePedidoCodigo,
        Subtotal: row.detallePedidoSubtotal,
        Cantidad: row.detallePedidoCantidad,
        Estado: row.detallePedidoEstado,
        Notas: row.detallePedidoNotas,
        Producto: {
          MenuCodigo: row.MenuCodigo,
          MenuPlatos: row.MenuPlatos,
          MenuPrecio: row.MenuPrecio,
          MenuDescripcion: row.MenuDescripcion,
          MenuImageUrl: row.MenuImageUrl,
          MenuEstado: row.MenuEstado,
          MenuEsPreparado: row.MenuEsPreparado,
        }
      });
    });

    const pedidos = Array.from(pedidosMap.values());

    res.status(200).json({
      success: true,
      data: pedidos
    });
  } catch (error) {
    console.error('Error al obtener pedidos por mesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener pedidos por mesa'
    });
  }
});

// ============================================================
// POST /pedido/actualizarDetallesPedido
// Versión MySQL: delegamos al SP que recibe JSON
// ============================================================
router.post('/actualizarDetallesPedido', async (req, res) => {
  const { PedidoCodigo, Detalles } = req.body;

  if (!PedidoCodigo || !Array.isArray(Detalles)) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere PedidoCodigo y Detalles válidos.'
    });
  }

  try {
    const detallesJson = JSON.stringify(Detalles);

    // CALL Proc_ActualizarDetallesPedido(@PedidoCodigo, @DetallesJson)
    await query(`CALL ${SP_ACTUALIZAR_DETALLES}(?, ?)`, [
      PedidoCodigo,
      detallesJson
    ]);

    emitirActualizacionPedidos(PedidoCodigo);

    res.json({
      success: true,
      message: 'Detalles del pedido actualizados correctamente.'
    });
  } catch (error) {
    console.error('Error en actualizarDetallesPedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar detalles del pedido'
    });
  }
});


// ============================================================
// POST /pedido/crearPedido
// Usa transacción MySQL + SP Proc_CrearPedido + ajuste de stock
// Ahora también guarda quién creó el pedido (mesero/admin).
// ============================================================
// router.post('/crearPedido', async (req, res) => {
//   const { MesaCodigo, Detalles } = req.body;

//   if (!MesaCodigo || !Array.isArray(Detalles) || Detalles.length === 0) {
//     return res.status(400).json({
//       success: false,
//       message: 'Datos inválidos: se requiere MesaCodigo y lista de Detalles.'
//     });
//   }

//   // 🧑‍🍳 Usuario que está creando el pedido (si viene por v2 con JWT)
//   // En /pedidos/crearPedido clásico, req.user será undefined y se enviará NULL.
//   const usuarioCodigo = req.user?.UsuarioCodigo || null;
//   const usuarioRol    = req.user?.UsuarioRol    || null;

//   const conn = await pool.getConnection();
//   try {
//     await conn.beginTransaction();

//     // 1) Crear pedido (cabecera + detalles) vía SP (usa JSON)
//     const detallesJson = JSON.stringify(Detalles);

//     // 👇 AHORA el SP recibe 4 parámetros:
//     // (MesaCodigo, DetallesJson, UsuarioCodigo, UsuarioRol)
//     const [rows] = await conn.query(
//       `CALL ${SP_CREAR_PEDIDO}(?, ?, ?, ?)`,
//       [MesaCodigo, detallesJson, usuarioCodigo, usuarioRol]
//     );

//     const created = unwrapRows(rows);
//     const pedidoCodigo = created[0]?.PedidoCodigoCreado;

//     if (!pedidoCodigo) {
//       throw new Error('No se pudo obtener el código del pedido creado.');
//     }

//     // 2) Ajustar stock por cada detalle (igual que antes)
//     for (const d of Detalles) {
//       const cantidad = Number(d.detallePedidoCantidad || 0);

//       if (d.MenuEsPreparado === 'A') {
//         // Menú con receta → Proc_ProcesarMenu
//         await conn.query(
//           `CALL ${SP_PROCESAR_MENU}(?, ?)`,
//           [d.detallePedidoMenuCodigo, cantidad]
//         );
//       } else {
//         // Menú simple (directo a insumo)
//         const [menuRows] = await conn.execute(
//           'SELECT MenuInsumoCodigo FROM Pedidos_Menu WHERE MenuCodigo = ?',
//           [d.detallePedidoMenuCodigo]
//         );
//         const insumoCodigo = menuRows[0]?.MenuInsumoCodigo;
//         if (!insumoCodigo) {
//           throw new Error(`No hay insumo asociado al menú ${d.detallePedidoMenuCodigo}`);
//         }

//         const [updResult] = await conn.execute(
//           `UPDATE dbo_Insumos
//              SET InsumoStockActual = InsumoStockActual - ?
//            WHERE InsumoCodigo = ?
//              AND InsumoStockActual >= ?`,
//           [cantidad, insumoCodigo, cantidad]
//         );

//         if (updResult.affectedRows === 0) {
//           throw new Error(`Stock insuficiente para insumo ${insumoCodigo}`);
//         }
//       }
//     }

//     // 3) Commit
//     await conn.commit();
//     emitirActualizacionPedidos();

//     res.status(201).json({
//       success: true,
//       message: 'Pedido creado y stock actualizado correctamente',
//       PedidoCodigo: pedidoCodigo
//     });
//   } catch (err) {
//     try {
//       await conn.rollback();
//     } catch {}
//     console.error('Error al crear pedido:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message || 'Error interno al crear pedido'
//     });
//   } finally {
//     conn.release();
//   }
// });

router.post('/crearPedido', async (req, res) => {
  const { MesaCodigo, Detalles } = req.body;

  if (!MesaCodigo || !Array.isArray(Detalles) || Detalles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos: se requiere MesaCodigo y lista de Detalles.'
    });
  }

  // Usuario que está creando el pedido (JWT v2)
  const usuarioCodigo = req.user?.UsuarioCodigo || null;
  const usuarioRol    = req.user?.UsuarioRol    || null;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Crear pedido (cabecera + detalles) vía SP
    const detallesJson = JSON.stringify(Detalles);

    const [rows] = await conn.query(
      `CALL ${SP_CREAR_PEDIDO}(?, ?, ?, ?)`,
      [MesaCodigo, detallesJson, usuarioCodigo, usuarioRol]
    );

    const created = unwrapRows(rows);
    const pedidoCodigo = created[0]?.PedidoCodigoCreado;

    if (!pedidoCodigo) {
      throw new Error('No se pudo obtener el código del pedido creado.');
    }

    // 2) Ajustar stock por cada detalle
    for (const d of Detalles) {
      const cantidad = Number(d.detallePedidoCantidad || 0);

      if (d.MenuEsPreparado === 'A') {
        // Menú con receta
        await conn.query(
          `CALL ${SP_PROCESAR_MENU}(?, ?)`,
          [d.detallePedidoMenuCodigo, cantidad]
        );
      } else {
        // Menú simple (directo a insumo)
        const [menuRows] = await conn.execute(
          'SELECT MenuInsumoCodigo FROM Pedidos_Menu WHERE MenuCodigo = ?',
          [d.detallePedidoMenuCodigo]
        );

        const insumoCodigo = menuRows[0]?.MenuInsumoCodigo;
        if (!insumoCodigo) {
          throw new Error(`No hay insumo asociado al menú ${d.detallePedidoMenuCodigo}`);
        }

        const [updResult] = await conn.execute(
          `UPDATE dbo_Insumos
             SET InsumoStockActual = InsumoStockActual - ?
           WHERE InsumoCodigo = ?
             AND InsumoStockActual >= ?`,
          [cantidad, insumoCodigo, cantidad]
        );

        if (updResult.affectedRows === 0) {
          throw new Error(`Stock insuficiente para insumo ${insumoCodigo}`);
        }
      }
    }

    await conn.commit();
    emitirActualizacionPedidos();

    res.status(201).json({
      success: true,
      message: 'Pedido creado y stock actualizado correctamente',
      PedidoCodigo: pedidoCodigo
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('Error al crear pedido:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error interno al crear pedido'
    });
  } finally {
    conn.release();
  }
});



// ============================================================
// DELETE /pedido/eliminar/:PedidoCodigo
// Restaura stock y luego elimina el pedido
// ============================================================
router.delete('/eliminar/:PedidoCodigo', async (req, res) => {
  try {
    const { PedidoCodigo } = req.params;
    if (!PedidoCodigo) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere PedidoCodigo para eliminar.'
      });
    }

    // 1) Leer todos los detalles del pedido
    const detalles = await query(
      `SELECT detallePedidoMenuCodigo, detallePedidoCantidad
         FROM Pedidos_DetallePedido
        WHERE detallePedidoPedidoCodigo = ?`,
      [PedidoCodigo]
    );

    // 2) Para cada detalle, devolver stock según tipo
    for (const d of detalles) {
      const menuInfo = await query(
        `SELECT MenuEsPreparado, MenuInsumoCodigo
           FROM Pedidos_Menu
          WHERE MenuCodigo = ?`,
        [d.detallePedidoMenuCodigo]
      );

      if (!menuInfo.length) continue;

      const { MenuEsPreparado, MenuInsumoCodigo } = menuInfo[0];
      const cantidad = Number(d.detallePedidoCantidad || 0);

      if (MenuEsPreparado === 'A') {
        // Menú con receta → SP de devolución
        await query(
          `CALL ${SP_DEVOLVER_STOCK_MENU}(?, ?)`,
          [d.detallePedidoMenuCodigo, cantidad]
        );
      } else {
        // Menú simple → directo a Insumos
        await query(
          `UPDATE dbo_Insumos
              SET InsumoStockActual = InsumoStockActual + ?
            WHERE InsumoCodigo = ?`,
          [cantidad, MenuInsumoCodigo]
        );
      }
    }

    // 3) Borrar pedido (cabecera + detalles) vía SP
    await query(`CALL ${SP_ELIMINAR_PEDIDO}(?)`, [PedidoCodigo]);

    res.status(200).json({
      success: true,
      message: 'Pedido eliminado y stock restaurado correctamente.'
    });
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al eliminar pedido'
    });
  }
});

// ============================================================
// Helpers de fechas (Lima)
// ============================================================
function formatFechaLima(fecha) {
  const lima = new Date(
    fecha.toLocaleString('en-US', { timeZone: 'America/Lima' })
  );
  return [
    lima.getFullYear(),
    String(lima.getMonth() + 1).padStart(2, '0'),
    String(lima.getDate()).padStart(2, '0')
  ].join('-');
}

function obtenerRangoFechasActivas() {
  const ahora = new Date();
  const lima = new Date(
    ahora.toLocaleString('en-US', { timeZone: 'America/Lima' })
  );

  const ayer = new Date(lima);
  ayer.setDate(lima.getDate() - 1);

  const manana = new Date(lima);
  manana.setDate(lima.getDate() + 1);

  return {
    fechaInicio: ayer.toISOString().split('T')[0],
    fechaFin: manana.toISOString().split('T')[0],
    fechaHoy: lima.toISOString().split('T')[0]
  };
}


// ============================================================
// GET /pedido/activos
// ============================================================ 

router.get('/activos', async (req, res) => {
  try {
    const rows = await query(`CALL ${SP_OBTENER_TODOS_LOS_PEDIDOS}()`);
    const recordset = unwrapRows(rows);

    const pedidosMap = new Map();
    recordset.forEach(row => {
      const key = row.PedidoCodigo;

      if (!pedidosMap.has(key)) {
        pedidosMap.set(key, {
          PedidoCodigo: row.PedidoCodigo,
          PedidoFechaHora: row.PedidoFechaHora,
          PedidoTotal: row.PedidoTotal,
          PedidoEstado: row.PedidoEstado,
          MesaCodigo: row.PedidoMesaCodigo,
          MesaNumero: row.MesaNumero,
          Detalles: []
        });
      }

      pedidosMap.get(key).Detalles.push({
        DetallePedidoCodigo: row.detallePedidoCodigo,
        Subtotal: row.detallePedidoSubtotal,
        Cantidad: row.detallePedidoCantidad,
        Estado: row.detallePedidoEstado,
        Notas: row.detallePedidoNotas,
        Producto: {
          MenuCodigo: row.MenuCodigo,
          MenuPlatos: row.MenuPlatos,
          MenuPrecio: row.MenuPrecio,
          MenuDescripcion: row.MenuDescripcion,
          MenuImageUrl: row.MenuImageUrl
        }
      });
    });

    // ✅ CORRECCIÓN: Filtro simplificado sin rango de fechas
    const pedidos = Array.from(pedidosMap.values()).filter(p => {
      const estado = (p.PedidoEstado || '').toLowerCase();
      
      // Solo excluir servidos y cancelados
      const esActivo = estado !== 'servido' && estado !== 'cancelado';
      
      console.log(
        `📋 Pedido ${p.PedidoCodigo}: fecha=${p.PedidoFechaHora}, estado="${estado}", activo=${esActivo}`
      );

      return esActivo;
    });

    console.log(`✅ Total pedidos activos: ${pedidos.length}`);
    
    res.status(200).json({
      success: true,
      data: pedidos
    });
  } catch (error) {
    console.error('❌ Error al obtener pedidos activos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener pedidos activos'
    });
  }
});

// ============================================================
// GET /pedido/hoy
// Obtiene TODOS los pedidos del día (incluyendo servidos, excluye cancelados)
// ============================================================
router.get('/hoy', async (req, res) => {
  try {
    const rows = await query(`CALL ${SP_OBTENER_TODOS_LOS_PEDIDOS}()`);
    const recordset = unwrapRows(rows);

    const pedidosMap = new Map();

    // Agrupar por PedidoCodigo (igual que en /activos)
    recordset.forEach(row => {
      const key = row.PedidoCodigo;

      if (!pedidosMap.has(key)) {
        pedidosMap.set(key, {
          PedidoCodigo: row.PedidoCodigo,
          PedidoFechaHora: row.PedidoFechaHora,
          PedidoTotal: row.PedidoTotal,
          PedidoEstado: row.PedidoEstado,
          MesaCodigo: row.PedidoMesaCodigo,
          MesaNumero: row.MesaNumero,
          Detalles: [],
        });
      }

      pedidosMap.get(key).Detalles.push({
        DetallePedidoCodigo: row.detallePedidoCodigo,
        Subtotal: row.detallePedidoSubtotal,
        Cantidad: row.detallePedidoCantidad,
        Estado: row.detallePedidoEstado,
        Notas: row.detallePedidoNotas,
        Producto: {
          MenuCodigo: row.MenuCodigo,
          MenuPlatos: row.MenuPlatos,
          MenuPrecio: row.MenuPrecio,
          MenuDescripcion: row.MenuDescripcion,
          MenuImageUrl: row.MenuImageUrl,
        },
      });
    });

    // ✅ Fecha de HOY en Lima
    const hoyIso = formatFechaLima(new Date());

    const pedidosHoy = Array.from(pedidosMap.values()).filter(p => {
      const fechaPedidoIso = formatFechaLima(new Date(p.PedidoFechaHora));
      const estado = (p.PedidoEstado || '').toLowerCase().trim();

      const esHoy = fechaPedidoIso === hoyIso;
      const noCancelado = estado !== 'cancelado';

      return esHoy && noCancelado;
    });

    console.log(`✅ /pedido/hoy -> ${pedidosHoy.length} pedidos`);

    res.status(200).json({
      success: true,
      data: pedidosHoy,
    });
  } catch (error) {
    console.error('❌ Error al obtener pedidos de hoy:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener pedidos de hoy',
    });
  }
});




// ============================================================
// PUT /pedido/actualizarEstadoPedido/:PedidoCodigo
// Registra cocinero si el estado pasa a "listo"
// ============================================================
router.put('/actualizarEstadoPedido/:PedidoCodigo', async (req, res) => {
  const { PedidoCodigo } = req.params;
  const { nuevoEstado } = req.body;

  if (!PedidoCodigo || !nuevoEstado) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere PedidoCodigo y nuevoEstado.'
    });
  }

  const usuarioCodigo = req.user?.UsuarioCodigo || null;
  const estadoLower = String(nuevoEstado).toLowerCase();

  try {
    // 1) Actualizar el estado normal via SP
    await query(
      `CALL ${SP_ACTUALIZAR_ESTADO_PEDIDO}(?, ?)`,
      [PedidoCodigo, nuevoEstado]
    );

    // 2) Si pasa a "listo" y hay usuario logueado → registrar COCINERO
    if (usuarioCodigo && estadoLower === 'listo') {
      await query(
        `
        UPDATE Pedidos_Pedido
        SET PedidoUsuarioCocinero = COALESCE(PedidoUsuarioCocinero, ?)
        WHERE PedidoCodigo = ?
        `,
        [usuarioCodigo, PedidoCodigo]
      );
    }

    emitirActualizacionPedidos(PedidoCodigo);
    res.json({
      success: true,
      message: 'Estado del pedido actualizado.'
    });
  } catch (error) {
    console.error('Error al actualizar estado del pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar estado del pedido'
    });
  }
});


function toLimaDate(date) {
  return new Date(
    new Date(date).toLocaleString('en-US', { timeZone: 'America/Lima' })
  );
}

// ============================================================
// GET /pedido/todos   (paginado en memoria)
// ============================================================
router.get('/todos', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const offset = (page - 1) * limit;

    const rows = await query(`CALL ${SP_OBTENER_TODOS_LOS_PEDIDOS}()`);
    const recordset = unwrapRows(rows);

    const pedidosMap = new Map();
    recordset.forEach(row => {
      const key = row.PedidoCodigo;
      if (!pedidosMap.has(key)) {
        pedidosMap.set(key, {
          PedidoCodigo: row.PedidoCodigo,
          PedidoFechaHora: row.PedidoFechaHora,
          PedidoTotal: row.PedidoTotal,
          PedidoEstado: row.PedidoEstado,
          MesaNumero: row.MesaNumero,
          Detalles: []
        });
      }
      pedidosMap.get(key).Detalles.push({
        DetallePedidoCodigo: row.detallePedidoCodigo,
        Subtotal: row.detallePedidoSubtotal,
        Cantidad: row.detallePedidoCantidad,
        Estado: row.detallePedidoEstado,
        Notas: row.detallePedidoNotas,
        Producto: {
          MenuCodigo: row.MenuCodigo,
          MenuPlatos: row.MenuPlatos,
          MenuPrecio: row.MenuPrecio,
          MenuDescripcion: row.MenuDescripcion,
          MenuImageUrl: row.MenuImageUrl,
          MenuEsPreparado: row.MenuEsPreparado,
          MenuCategoria: row.MenuCategoria
        }
      });
    });

    const pedidos = Array.from(pedidosMap.values());
    const paginatedPedidos = pedidos.slice(offset, offset + limit);

    res.status(200).json({
      success: true,
      data: paginatedPedidos
    });
  } catch (error) {
    console.error('Error al obtener todos los pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener todos los pedidos'
    });
  }
});

// ============================================================
// PUT /pedido/actualizarEstadoDetalle/:detallePedidoCodigo
// ============================================================
router.put('/actualizarEstadoDetalle/:detallePedidoCodigo', async (req, res) => {
  const { detallePedidoCodigo } = req.params;
  const { nuevoEstado } = req.body;

  if (!detallePedidoCodigo || !nuevoEstado) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere detallePedidoCodigo y nuevoEstado.'
    });
  }

  try {
    await query(
      `CALL ${SP_ACTUALIZAR_ESTADO_DETALLE}(?, ?)`,
      [detallePedidoCodigo, nuevoEstado]
    );

    emitirActualizacionPedidos(detallePedidoCodigo);
    res.json({
      success: true,
      message: 'Estado del detalle actualizado.'
    });
  } catch (error) {
    console.error('Error al actualizar estado del detalle:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar estado del detalle'
    });
  }
});
// POST /pedidos/finalizar/:pedidoCodigo
// Registra quién COBRA el pedido (mesero o admin)
router.post('/finalizar/:pedidoCodigo', async (req, res) => {
  const { pedidoCodigo } = req.params;      // ej: PED0000001
  const { metodoPagoCodigo } = req.body;    // ej: MPA0000001

  const usuarioCodigo = req.user?.UsuarioCodigo || null;

  console.log(
    '📥 POST /pedidos/finalizar',
    'pedidoCodigo=', pedidoCodigo,
    'metodoPagoCodigo=', metodoPagoCodigo,
    'body=', req.body
  );

  if (!metodoPagoCodigo) {
    console.warn('⚠️ No se envió metodoPagoCodigo');
    return res.status(400).json({
      success: false,
      message: 'Debe indicar el campo metodoPagoCodigo',
    });
  }

  const sql = `
    UPDATE Pedidos_Pedido
    SET 
      PedidoMetodoPagoCodigo = ?,
      PedidoEstado = "servido",
      PedidoUsuarioCobro = COALESCE(PedidoUsuarioCobro, ?)
    WHERE PedidoCodigo = ?
  `;

  try {
    console.log('🔧 Ejecutando UPDATE de pedido (async/await)...');

    const [result] = await pool.query(sql, [
      metodoPagoCodigo,
      usuarioCodigo,
      pedidoCodigo
    ]);

    console.log('🔧 Resultado UPDATE:', result);

    if (result.affectedRows === 0) {
      console.warn(`⚠️ No se encontró el pedido ${pedidoCodigo} para actualizar`);
      return res.status(404).json({
        success: false,
        message: `No se encontró el pedido ${pedidoCodigo}`,
      });
    }

    console.log(
      `✅ Pedido ${pedidoCodigo} finalizado (filas afectadas: ${result.affectedRows})`
    );

    emitirActualizacionPedidos(pedidoCodigo);

    return res.json({
      success: true,
      message: `Pedido ${pedidoCodigo} finalizado con método de pago ${metodoPagoCodigo}`,
    });
  } catch (err) {
    console.error('❌ Error al finalizar pedido:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al finalizar el pedido',
    });
  }
});


module.exports = router;

