// c:\github\ministerio-antioquia\connection.js
const mysql = require('mysql2/promise');

// Configuração da conexão com o banco de dados
const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Lpreche135#',
    database: 'movimento_antioquia',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('Pool de conexões criado para o banco movimento_antioquia');

module.exports = connection;
