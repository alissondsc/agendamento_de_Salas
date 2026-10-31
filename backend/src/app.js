import cors from 'cors';
import express from 'express';

export function createApp({ database, allowedOrigins = [] }) {
    const app = express();
    const origins = new Set(allowedOrigins);

    app.use(cors({
        origin(origin, callback) {
            if (!origin || origins.has(origin)) {
                callback(null, true);
                return;
            }

            callback(null, false);
        }
    }));
    app.use(express.json({ limit: '100kb' }));

    app.get('/api/health', async (request, response) => {
        try {
            await database.ping();
            response.status(200).json({ status: 'ok', database: 'connected' });
        } catch (error) {
            console.error('Falha ao verificar conexão com o banco de dados:', error);
            response.status(503).json({ status: 'error', database: 'unavailable' });
        }
    });

    return app;
}
