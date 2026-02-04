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

// Testa a conexão para garantir que o pool foi criado com sucesso
connection.getConnection()
    .then(conn => {
        console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');
        conn.release(); // Libera a conexão de volta para o pool
    })
    .catch(err => {
        console.error('❌ ERRO FATAL: Não foi possível conectar ao banco de dados:', err);
    });

module.exports = connection;
