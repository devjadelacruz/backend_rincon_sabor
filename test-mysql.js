// test-mysql.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ Conectado a MySQL correctamente');

    // Hacemos una consulta simple para verificar
    const [rows] = await connection.query('SELECT 1 AS resultado');
    console.log('Resultado de prueba:', rows);

    await connection.end();
    console.log('✅ Conexión cerrada sin problemas');
  } catch (err) {
    console.error('❌ Error al conectar a MySQL:');
    console.error('Mensaje:', err.message);
    console.error(err);
  }
}

main();
