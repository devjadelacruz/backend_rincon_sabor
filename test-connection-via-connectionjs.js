// test-connection-via-connectionjs.js
const { query } = require('./config/connection'); // 👈 OJO: ./config/connection

async function main() {
  try {
    const rows = await query('SELECT 1 AS resultado');
    console.log('✅ Conexión vía connection.js OK');
    console.log('Resultado:', rows);
  } catch (err) {
    console.error('❌ Error usando connection.js');
    console.error(err.message);
  }
}

main();
