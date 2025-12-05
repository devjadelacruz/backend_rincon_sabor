// services/menuService.js
const { query } = require('../config/connection');
const { emitirActualizacionMenus } = require('../sockets/menuSocket');

// Nombres de procedimientos almacenados
const SP_MOSTRAR_MENU_COMPLETO    = 'Proc_MostrarMenuCompleto';
const SP_INSERTAR_MENU           = 'Proc_InsertarMenu';
const SP_CREAR_RECETA            = 'Proc_CrearReceta';
const SP_INSERTAR_INSUMO         = 'Proc_InsertarInsumo';
const SP_ELIMINAR_MENU           = 'Proc_EliminarMenu';
const SP_PROCESAR_MENU           = 'Proc_ProcesarMenu';
const SP_OBTENER_INFO_MENU       = 'ObtenerInformacionMenu';
const SP_ACTUALIZAR_MENU_COMPLETO = 'Proc_ActualizarMenuCompleto';

/**
 * Helper genérico para llamar SP con mysql2.
 * Devuelve SOLO el primer recordset (la “tabla” principal).
 */
async function callProc(name, params = []) {
  const placeholders = params.map(() => '?').join(', ');
  const sql = `CALL ${name}(${placeholders})`;

  const raw = await query(sql, params);
  // Para CALL, mysql2 devuelve normalmente: [ [rowsResultSet1, rowsResultSet2, ...] ]
  // pero nuestro query() suele des envolver a [resultSets] ya.
  // Así que aquí nos quedamos con el primer resultset.
  const rows =
    Array.isArray(raw) && Array.isArray(raw[0])
      ? raw[0]   // primer resultset
      : raw;     // caso normal (un solo set plano)

  return rows;
}

/**
 * Inserta un menú de tipo “insumo directo” (MenuEsPreparado = 'I')
 * 1) Crea el insumo
 * 2) Crea el menú que usa ese insumo
 */
const insertarMenuConInsumo = async ({
  MenuPlatos,
  MenuDescripcion,
  MenuPrecio,
  imageUrl,
  MenuCategoriaCodigo,
  InsumoUnidadMedida,
  InsumoStockActual,
  InsumoCompraUnidad
}) => {
  // 1. Insertar Insumo
  const insumoRows = await callProc(SP_INSERTAR_INSUMO, [
    MenuPlatos,
    InsumoUnidadMedida,
    InsumoStockActual,
    InsumoCompraUnidad
  ]);

  const insumoCodigo = insumoRows[0]?.InsumoCodigoCreado;

  // 2. Insertar Menú asociado al insumo
  const menuRows = await callProc(SP_INSERTAR_MENU, [
    MenuPlatos,
    MenuDescripcion,
    MenuPrecio,
    imageUrl || null,
    'I',             // MenuEsPreparado
    insumoCodigo,    // MenuInsumoCodigo
    MenuCategoriaCodigo
  ]);

  const menuCodigo = menuRows[0]?.MenuCodigoCreado;

  emitirActualizacionMenus();
  return { MenuCodigoCreado: menuCodigo };
};

/**
 * Inserta un menú con receta (MenuEsPreparado = 'A')
 * 1) Crea el menú
 * 2) Crea la receta del menú
 * 3) Inserta los detalles de la receta
 */
const insertarMenuConReceta = async ({
  MenuPlatos,
  MenuDescripcion,
  MenuPrecio,
  imageUrl,
  MenuCategoriaCodigo,
  DetallesReceta
}) => {
  // 1. Insertar Menú sin insumo directo
  const menuRows = await callProc(SP_INSERTAR_MENU, [
    MenuPlatos,
    MenuDescripcion,
    MenuPrecio,
    imageUrl || null,
    'A',    // MenuEsPreparado
    null,   // MenuInsumoCodigo
    MenuCategoriaCodigo
  ]);

  const menuCodigo = menuRows[0]?.MenuCodigoCreado;

  // 2. Crear receta para ese menú
  const recetaRows = await callProc(SP_CREAR_RECETA, [menuCodigo]);
  const recetaCodigo = recetaRows[0]?.RecetaCodigoCreado;

  // 3. Insertar detalles de la receta (uno por insumo)
  if (Array.isArray(DetallesReceta)) {
    for (const detalle of DetallesReceta) {
      console.log('Insertando detalle de receta:', detalle);
      await callProc('Proc_CrearDetalleReceta', [
        recetaCodigo,
        detalle.insumoCodigo,
        detalle.cantidad
      ]);
    }
  }

  emitirActualizacionMenus();
  return { MenuCodigoCreado: menuCodigo, RecetaCodigoCreado: recetaCodigo };
};

/**
 * Obtiene TODOS los menús disponibles usando el SP Proc_MostrarMenuCompleto
 */
const obtenerMenus = async () => {
  // 👉 aquí usamos el SP original de tu script MySQL
  const rows = await callProc(SP_MOSTRAR_MENU_COMPLETO, []);

  console.log(`🍽️ Menús cargados desde el SP ${SP_MOSTRAR_MENU_COMPLETO}:`, rows.length);
  if (rows.length > 0) {
    console.log('🔎 Primer menú devuelto al front:\n', JSON.stringify(rows.slice(0, 1), null, 2));
  }

  // Adaptamos los campos al formato que espera Flutter
  return rows.map(row => ({
    MenuCodigo: row.MenuCodigo,
    MenuPlatos: row.MenuPlatos,
    MenuDescripcion: row.MenuDescripcion,
    MenuPrecio: parseFloat(row.MenuPrecio),
    MenuEstado: row.MenuEstado,
    MenuImageUrl: row.MenuImageUrl,
    MenuEsPreparado: row.MenuEsPreparado,

    // Estos dos los usamos también sueltos
    MenuCategoriaCodigo: row.CategoriaCodigo,
    MenuInsumoCodigo: row.InsumoCodigo || null,

    // Para el filtrado y disponibilidad
    MenuDisponible:
      row.MenuDisponible === 1 ||
      row.MenuDisponible === '1' ||
      row.MenuDisponible === true,
    InsumosFaltantes: row.InsumosFaltantes || '',

    // Objeto anidado de categoría (lo que usa Menu.categoria en Flutter)
    Categoria: {
      CategoriaCodigo: row.CategoriaCodigo,
      CategoriaNombre: row.CategoriaNombre,
      CategoriaDescripcion: row.CategoriaDescripcion,
      CategoriaEstado: row.CategoriaEstado
    },

    // Objeto anidado de insumo solo si aplica (MenuEsPreparado = 'I')
    Insumo: row.InsumoCodigo
      ? {
          InsumoCodigo: row.InsumoCodigo,
          InsumoNombre: row.InsumoNombre,
          InsumoUnidadMedida: row.InsumoUnidadMedida,
          InsumoStockActual: row.InsumoStockActual
            ? parseFloat(row.InsumoStockActual)
            : null,
          InsumoCompraUnidad: row.InsumoCompraUnidad
            ? parseFloat(row.InsumoCompraUnidad)
            : null,
          InsumoEstado: row.InsumoEstado
        }
      : null
  }));
};

/**
 * Elimina un menú por código
 */
const eliminarMenu = async (MenuCodigo) => {
  await callProc(SP_ELIMINAR_MENU, [MenuCodigo]);
  emitirActualizacionMenus();
  return { message: `Menú ${MenuCodigo} eliminado correctamente` };
};

/**
 * Procesa el menú (rebaja stock, etc.) usando el SP Proc_ProcesarMenu
 */
async function procesarMenu(menuCodigo, cantidad) {
  await callProc(SP_PROCESAR_MENU, [menuCodigo, cantidad]);
}

/**
 * Obtiene la info completa de un menú: datos generales + detalles de receta.
 * Aquí NO usamos callProc porque necesitamos los dos recordsets del SP.
 */
const obtenerMenuPorCodigo = async (menuCodigo) => {
  const { pool } = require('../config/connection');

  const sqlCall = `CALL ${SP_OBTENER_INFO_MENU}(?)`;
  // Para CALL, mysql2 devuelve: [ [rowsSet1, rowsSet2, ...], fields ]
  const [resultSets] = await pool.execute(sqlCall, [menuCodigo]);

  const infoGeneralRows = Array.isArray(resultSets[0]) ? resultSets[0] : [];
  const detallesRows    = Array.isArray(resultSets[1]) ? resultSets[1] : [];

  const infoMenu = infoGeneralRows[0];

  return {
    ...infoMenu,
    DetallesReceta: detallesRows
  };
};

/**
 * Actualiza un menú completo usando el SP Proc_ActualizarMenuCompleto
 * Este SP recibe los detalles de receta en JSON.
 */
const actualizarMenuCompleto = async (menu) => {
  // Armamos el JSON solo si es preparado con receta
  let detallesJson = null;
  if (menu.MenuEsPreparado === 'A' && Array.isArray(menu.DetallesReceta)) {
    const soloCamposNecesarios = menu.DetallesReceta.map(d => ({
      insumoCodigo: d.insumoCodigo,
      cantidad: d.cantidad
    }));
    detallesJson = JSON.stringify(soloCamposNecesarios);
  }

  await query(
    `CALL ${SP_ACTUALIZAR_MENU_COMPLETO}(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      menu.MenuCodigo,
      menu.MenuPlatos,
      menu.MenuDescripcion,
      menu.MenuPrecio,
      menu.MenuEstado,
      menu.MenuImageUrl || null,
      menu.MenuCategoriaCodigo,
      menu.MenuEsPreparado,
      menu.MenuInsumoCodigo || null,
      detallesJson
    ]
  );

  emitirActualizacionMenus();
};

module.exports = {
  insertarMenuConReceta,
  insertarMenuConInsumo,
  obtenerMenus,
  eliminarMenu,
  procesarMenu,
  obtenerMenuPorCodigo,
  actualizarMenuCompleto
};
