const mysql = require('mysql2/promise');
const path = require('path');
// Carrega o arquivo .env a partir da raiz do projeto
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Configuração do pool de conexões com o banco de dados
const connection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'movimento_antioquia',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
});

module.exports = connection;
