const mysql = require('mysql2/promise');
const path = require('path');
// Carrega o arquivo .env a partir da raiz do projeto local
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Detecta automaticamente se está rodando no Render (Render define RENDER=true)
const isRender = process.env.RENDER === 'true';

// Configuração do banco de dados:
// - Em Desenvolvimento Local: usa as variáveis do seu arquivo .env local (localhost:3306)
// - Em Produção (Render): usa as variáveis de ambiente injetadas no painel do Render com SSL automático
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'antioquia_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'movimento_antioquia',
    ssl: (process.env.DB_SSL === 'true' || isRender) ? { rejectUnauthorized: false } : false
};

const connection = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = connection;
