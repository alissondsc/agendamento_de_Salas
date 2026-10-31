import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

const servers = new Set();

afterEach(async () => {
    await Promise.all([...servers].map((server) => new Promise((resolve, reject) => {
        server.close((error) => {
            servers.delete(server);
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    })));
});

async function startServer(database, allowedOrigins = []) {
    const server = createApp({ database, allowedOrigins }).listen(0);
    servers.add(server);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    return `http://127.0.0.1:${server.address().port}`;
}

test('GET /api/health reports a successful database connection', async () => {
    let pingCalls = 0;
    const baseUrl = await startServer({
        async ping() {
            pingCalls += 1;
        }
    });

    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        status: 'ok',
        database: 'connected'
    });
    assert.equal(pingCalls, 1);
});

test('GET /api/health reports a database failure as unavailable', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        const baseUrl = await startServer({
            async ping() {
                throw new Error('database connection failed');
            }
        });

        const response = await fetch(`${baseUrl}/api/health`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
            status: 'error',
            database: 'unavailable'
        });
    } finally {
        console.error = originalConsoleError;
    }
});

test('rejects browser origins not present in the CORS allowlist', async () => {
    const baseUrl = await startServer({ async ping() {} }, ['http://localhost:5500']);
    const allowedResponse = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'http://localhost:5500' }
    });
    const rejectedResponse = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'https://untrusted.example' }
    });

    assert.equal(allowedResponse.headers.get('access-control-allow-origin'), 'http://localhost:5500');
    assert.equal(rejectedResponse.status, 200);
    assert.equal(rejectedResponse.headers.get('access-control-allow-origin'), null);
});

test('requires database configuration before creating a connection pool', () => {
    assert.throws(
        () => createDatabase({}),
        /MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD/
    );
});
