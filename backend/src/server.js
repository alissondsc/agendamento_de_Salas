import 'dotenv/config';
import { createApp } from './app.js';
import { createDatabase } from './database.js';

const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CORS_ORIGINS
    || 'http://localhost:5500,http://127.0.0.1:5500')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const database = createDatabase();
const app = createApp({ database, allowedOrigins });
let server;

async function start() {
    try {
        await database.initialize();
        server = app.listen(port, () => {
            console.log(`API disponível em http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Falha ao inicializar o banco de dados:', error);
        await database.close();
        process.exitCode = 1;
    }
}

function shutdown() {
    if (!server) {
        return;
    }

    server.close(async (error) => {
        if (error) {
            console.error('Falha ao encerrar o servidor HTTP:', error);
            process.exitCode = 1;
        }

        try {
            await database.close();
        } catch (databaseError) {
            console.error('Falha ao encerrar o pool do banco de dados:', databaseError);
            process.exitCode = 1;
        }
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
start();
