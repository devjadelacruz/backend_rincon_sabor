// routes/dataGraficos.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/connection');

// Nombres de SP en MySQL (sin esquema)
const SP_GANANCIAS_RESUMEN = 'Proc_ResumenDiarioDelAnio';
const SP_OBTENER_PEDIDOS_ACTIVOS = 'Proc_ObtenerTodosLosPedidos';
const SP_OBTENER_MESAS = 'Proc_ObtenerMesas';

// Helper para desenrollar resultado de CALL
const unwrapRows = (rows) => {
  // mysql2 para CALL devuelve: [ [rows], [meta] ]
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    return rows[0];
  }
  return rows;
};

// Función para formatear la fecha según la zona horaria de Lima
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

/* ==========================
   GET /api/data/ventasHoy
   ========================== */
router.get('/ventasHoy', async (req, res) => {
  try {
    const hoyIso = formatFechaLima(new Date());
    console.log('hoyIso (Lima):', hoyIso);

    // CALL Proc_ObtenerTodosLosPedidos()
    const rows = await query(`CALL ${SP_OBTENER_PEDIDOS_ACTIVOS}()`);
    const data = unwrapRows(rows);

    const pedidosHoy = data.filter(row => {
      const fechaIso = formatFechaLima(new Date(row.PedidoFechaHora));
      return fechaIso === hoyIso;
    });

    const totalVentas = pedidosHoy.reduce(
      (ac, row) => ac + Number(row.PedidoTotal || 0),
      0
    );

    res.status(200).json({
      success: true,
      data: {
        fecha: hoyIso,
        totalVentas
      }
    });
  } catch (error) {
    console.error('Error al obtener las ventas de hoy:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener las ventas de hoy'
    });
  }
});

/* ==========================
   GET /api/data/pedidosHoy
   ========================== */
router.get('/pedidosHoy', async (req, res) => {
  try {
    const hoyIso = formatFechaLima(new Date());
    console.log('hoyIso (Lima):', hoyIso);

    const rows = await query(`CALL ${SP_OBTENER_PEDIDOS_ACTIVOS}()`);
    const data = unwrapRows(rows);

    const filteredRecords = data.filter(row => {
      const fechaIso = formatFechaLima(new Date(row.PedidoFechaHora));
      return fechaIso === hoyIso;
    });

    // Agrupar por PedidoCodigo
    const groupedData = filteredRecords.reduce((acc, row) => {
      if (!acc[row.PedidoCodigo]) {
        acc[row.PedidoCodigo] = {
          PedidoCodigo: row.PedidoCodigo,
          Detalles: []
        };
      }
      acc[row.PedidoCodigo].Detalles.push({
        detallePedidoCodigo: row.detallePedidoCodigo,
        detallePedidoSubtotal: row.detallePedidoSubtotal
      });
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: Object.values(groupedData)
    });
  } catch (error) {
    console.error('Error al obtener pedidos activos filtrados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener pedidos activos filtrados'
    });
  }
});

/* ==========================
   GET /api/data/disponibles
   ========================== */
router.get('/disponibles', async (req, res) => {
  try {
    const rows = await query(`CALL ${SP_OBTENER_MESAS}()`);
    const mesas = unwrapRows(rows);

    const disponibles = mesas.filter(m => m.MesaEstado === 'Disponible').length;
    const total = mesas.length;

    res.status(200).json({
      success: true,
      data: `${disponibles}/${total}`,
      mesas: mesas.map(mesa => ({
        MesaCodigo: mesa.MesaCodigo,
        MesaEstado: mesa.MesaEstado
      }))
    });
  } catch (error) {
    console.error('Error al obtener mesas disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener mesas disponibles'
    });
  }
});

/* ======================================
   GET /api/data/gananciasMesActual
   ====================================== */
router.get('/gananciasMesActual', async (req, res) => {
  try {
    const hoy = new Date();
    const hoyLima = new Date(
      hoy.toLocaleString('en-US', { timeZone: 'America/Lima' })
    );
    const anio = hoyLima.getFullYear();
    const mes = hoyLima.getMonth() + 1;

    const rows = await query(`CALL ${SP_GANANCIAS_RESUMEN}(?)`, [anio]);
    const data = unwrapRows(rows);

    const registrosMesActual = data.filter(row => {
      const fechaRow = new Date(row.Fecha);
      const fechaLima = new Date(
        fechaRow.toLocaleString('en-US', { timeZone: 'America/Lima' })
      );
      return (
        fechaLima.getFullYear() === anio &&
        fechaLima.getMonth() + 1 === mes &&
        row.NumeroPedidos > 0
      );
    });

    const totalGanancias = registrosMesActual.reduce(
      (ac, row) => ac + Number(row.GananciasDelDia || 0),
      0
    );
    const totalPedidos = registrosMesActual.reduce(
      (ac, row) => ac + Number(row.NumeroPedidos || 0),
      0
    );

    res.status(200).json({
      success: true,
      data: {
        anio,
        mes,
        totalGanancias,
        totalPedidos,
        detalles: registrosMesActual
      }
    });
  } catch (error) {
    console.error('Error al obtener ganancias del mes actual:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener las ganancias del mes actual'
    });
  }
});

/* ======================================
   GET /api/data/gananciasSemanales
   (vista MySQL Ventas_VistaGananciasDeLasSemanas)
   ====================================== */
router.get('/gananciasSemanales', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        Semana,
        FechaInicioSemana,
        FechaFinSemana,
        TotalGanancia
      FROM Ventas_VistaGananciasDeLasSemanas
      WHERE FechaInicioSemana >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      ORDER BY FechaInicioSemana
    `);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener ganancias semanales:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener ganancias semanales'
    });
  }
});

/* ======================================
   GET /api/data/gananciasDiarias
   ====================================== */
router.get('/gananciasDiarias', async (req, res) => {
  try {
    const anio = new Date().getFullYear();
    const rows = await query(`CALL ${SP_GANANCIAS_RESUMEN}(?)`, [anio]);
    const data = unwrapRows(rows);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error al obtener ganancias diarias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al obtener ganancias diarias'
    });
  }
});

/* ======================================
   GET /api/data/gananciasMensuales
   (para gráfica circular)
   ====================================== */
router.get('/gananciasMensuales', async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear();

    const rows = await query(`CALL ${SP_GANANCIAS_RESUMEN}(?)`, [anio]);
    const data = unwrapRows(rows);

    const mensual = {};
    data.forEach(row => {
      const mes = new Date(row.Fecha).getMonth() + 1;
      if (!mensual[mes]) {
        mensual[mes] = { Mes: mes, Ganancias: 0, Pedidos: 0 };
      }
      mensual[mes].Ganancias += Number(row.GananciasDelDia || 0);
      mensual[mes].Pedidos += Number(row.NumeroPedidos || 0);
    });

    const agrupado = Object.values(mensual).sort((a, b) => a.Mes - b.Mes);

    res.status(200).json({
      success: true,
      data: agrupado
    });
  } catch (error) {
    console.error('Error agrupando mensual:', error);
    res.status(500).json({ success: false });
  }
});

/* ======================================
   GET /api/data/gananciasSemanales2
   (gráfica lineal épica global)
   ====================================== */
router.get('/gananciasSemanales2', async (req, res) => {
  try {
    const anio = new Date().getFullYear();
    const rows = await query(`CALL ${SP_GANANCIAS_RESUMEN}(?)`, [anio]);
    const data = unwrapRows(rows);

    const semanal = {};
    data.forEach(row => {
      if (row.NumeroPedidos > 0) {
        const fecha = new Date(row.Fecha);
        const firstDayOfYear = new Date(fecha.getFullYear(), 0, 1);
        const pastDaysOfYear = (fecha - firstDayOfYear) / 86400000;
        const semana = Math.ceil(
          (pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7
        );

        if (!semanal[semana]) {
          semanal[semana] = { Semana: semana, Ganancias: 0, Pedidos: 0 };
        }
        semanal[semana].Ganancias += Number(row.GananciasDelDia || 0);
        semanal[semana].Pedidos += Number(row.NumeroPedidos || 0);
      }
    });

    const agrupado = Object.values(semanal).sort(
      (a, b) => a.Semana - b.Semana
    );

    res.status(200).json({
      success: true,
      data: agrupado
    });
  } catch (error) {
    console.error('Error agrupando semanal:', error);
    res.status(500).json({ success: false });
  }
});

/* ======================================
   GET /api/data/gananciasSemanalesPorMes
   (gráfica lineal por semanas del mes)
   ====================================== */
router.get('/gananciasSemanalesPorMes', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const mes = parseInt(req.query.mes);

    if (!mes || mes < 1 || mes > 12) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro mes inválido'
      });
    }

    const rows = await query(`CALL ${SP_GANANCIAS_RESUMEN}(?)`, [anio]);
    let data = unwrapRows(rows);

    data = data.filter(row => {
      const fecha = new Date(row.Fecha);
      return (
        fecha.getFullYear() === anio &&
        fecha.getMonth() + 1 === mes &&
        row.NumeroPedidos > 0
      );
    });

    const semanal = {};
    data.forEach(row => {
      const fecha = new Date(row.Fecha);
      const diaMes = fecha.getDate();
      const semana = Math.ceil(diaMes / 7);

      if (!semanal[semana]) {
        semanal[semana] = {
          SemanaDelMes: semana,
          Ganancias: 0,
          Pedidos: 0
        };
      }
      semanal[semana].Ganancias += Number(row.GananciasDelDia || 0);
      semanal[semana].Pedidos += Number(row.NumeroPedidos || 0);
    });

    const agrupado = Object.values(semanal).sort(
      (a, b) => a.SemanaDelMes - b.SemanaDelMes
    );

    res.status(200).json({
      success: true,
      data: agrupado
    });
  } catch (error) {
    console.error('Error agrupando semanal por mes:', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
