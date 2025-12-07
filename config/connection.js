// config/connection.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} = process.env;

// 👀 Log de debug (ya lo tenías)
console.log('🌐 Config DB desde connection.js:', {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_NAME,
});

const pool = mysql.createPool({
  host: DB_HOST || 'localhost',
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4', // aseguramos utf8mb4
});

// Helper para hacer consultas rápidas: query('SELECT ...', [params])
// 👇 Aquí forzamos la colación de la conexión en CADA query
async function query(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    // Forzar collation de la conexión a la misma que tus tablas
    await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
}

module.exports = { pool, query };
