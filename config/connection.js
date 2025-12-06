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

// 👇 DEBUG: ver exactamente a qué DB se está conectando Render
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
});

// Helper para hacer consultas rápidas: query('SELECT ...', [params])
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, query };
