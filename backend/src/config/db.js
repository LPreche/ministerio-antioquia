const mysql = require('mysql2/promise');
const path = require('path');
// Carrega o arquivo .env a partir da raiz do projeto
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Configuração dinâmica para ambiente Local (development) ou Produção Aiven (production)
const isProd = process.env.NODE_ENV === 'production' || process.env.USE_PROD_DB === 'true';

const prodSsl = process.env.PROD_DB_SSL !== undefined ? process.env.PROD_DB_SSL : process.env.DB_SSL;

const dbConfig = isProd ? {
    host: process.env.PROD_DB_HOST || process.env.DB_HOST,
    port: process.env.PROD_DB_PORT ? Number(process.env.PROD_DB_PORT) : (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306),
    user: process.env.PROD_DB_USER || process.env.DB_USER,
    password: process.env.PROD_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.PROD_DB_NAME || process.env.DB_NAME || 'movimento_antioquia',
    ssl: prodSsl === 'false' ? false : { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'movimento_antioquia',
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
};

const connection = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = connection;
