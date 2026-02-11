// c:\github\ministerio-antioquia\connection.js
const mysql = require('mysql2/promise');
require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env

// Configuração da conexão com o banco de dados
const connection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'movimento_antioquia',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = connection;
