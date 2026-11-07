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

test('registers an account with a password hash and authenticates it', async () => {
    const users = new Map();
    const database = {
        async createUser(user) {
            if (users.has(user.email)) {
                const error = new Error('duplicate email');
                error.code = 'ER_DUP_ENTRY';
                throw error;
            }

            const created = { id: 1, nome: user.nome, email: user.email };
            users.set(user.email, {
                ...created,
                senha_hash: user.senhaHash,
                senha_salt: user.senhaSalt
            });
            return created;
        },
        async findUserByEmail(email) {
            return users.get(email) ?? null;
        }
    };
    const baseUrl = await startServer(database);

    const registration = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome: '  Ana Souza ',
            email: ' ANA@EXAMPLE.COM ',
            senha: 'senha-segura-123'
        })
    });
    const registrationBody = await registration.json();
    assert.equal(registration.status, 201);
    assert.deepEqual(registrationBody, {
        user: { id: 1, nome: 'Ana Souza', email: 'ana@example.com' }
    });
    assert.notEqual(users.get('ana@example.com').senha_hash, 'senha-segura-123');

    const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ANA@example.com', senha: 'senha-segura-123' })
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), {
        user: { id: '1', nome: 'Ana Souza', email: 'ana@example.com' }
    });
});

test('rejects invalid registration data and duplicate e-mails', async () => {
    const database = {
        async createUser() {
            const error = new Error('duplicate email');
            error.code = 'ER_DUP_ENTRY';
            throw error;
        }
    };
    const baseUrl = await startServer(database);

    const invalidRegistration = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'A', email: 'invalido', senha: '123' })
    });
    assert.equal(invalidRegistration.status, 400);

    const duplicateRegistration = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome: 'Ana Souza',
            email: 'ana@example.com',
            senha: 'senha-segura-123'
        })
    });
    assert.equal(duplicateRegistration.status, 409);
});

test('rejects incorrect login credentials', async () => {
    const baseUrl = await startServer({
        async findUserByEmail() {
            return null;
        }
    });
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ana@example.com', senha: 'senha-incorreta' })
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'E-mail ou senha incorretos.' });
});

test('lists rooms and reservations', async () => {
    const database = {
        async listRooms() {
            return [{ id: '1', nome: 'Sala Horizonte', capacidade: 30, recursos: [] }];
        },
        async listReservations() {
            return [{ id: '2', sala_nome: 'Sala Horizonte', situacao: 'pendente' }];
        }
    };
    const baseUrl = await startServer(database);

    const roomsResponse = await fetch(`${baseUrl}/api/salas`);
    assert.equal(roomsResponse.status, 200);
    assert.deepEqual(await roomsResponse.json(), {
        salas: [{ id: '1', nome: 'Sala Horizonte', capacidade: 30, recursos: [] }]
    });

    const reservationsResponse = await fetch(`${baseUrl}/api/reservas`);
    assert.equal(reservationsResponse.status, 200);
    assert.deepEqual(await reservationsResponse.json(), {
        reservas: [{ id: '2', sala_nome: 'Sala Horizonte', situacao: 'pendente' }]
    });
});

test('creates valid room reservations and rejects invalid periods and capacity errors', async () => {
    const createdReservations = [];
    const database = {
        async createReservation(reservation) {
            if (reservation.quantidadeAlunos > 30) {
                const error = new Error('A turma excede a capacidade da sala.');
                error.code = 'ROOM_CAPACITY_EXCEEDED';
                throw error;
            }

            createdReservations.push(reservation);
            return { id: '9' };
        }
    };
    const baseUrl = await startServer(database);
    const validBody = {
        sala_id: '1',
        data_inicio: '2026-11-07T09:00',
        data_fim: '2026-11-07T10:00',
        responsavel: 'Ana Souza',
        finalidade: 'Reunião de planejamento',
        quantidade_alunos: 25
    };

    const validResponse = await fetch(`${baseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody)
    });
    assert.equal(validResponse.status, 201);
    assert.deepEqual(await validResponse.json(), { reserva: { id: '9' } });
    assert.deepEqual(createdReservations[0], {
        salaId: 1,
        dataInicio: '2026-11-07 09:00:00',
        dataFim: '2026-11-07 10:00:00',
        responsavel: 'Ana Souza',
        finalidade: 'Reunião de planejamento',
        quantidadeAlunos: 25
    });

    const invalidPeriodResponse = await fetch(`${baseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, data_fim: '2026-11-07T09:00' })
    });
    assert.equal(invalidPeriodResponse.status, 400);

    const capacityResponse = await fetch(`${baseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, quantidade_alunos: 31 })
    });
    assert.equal(capacityResponse.status, 409);
});

test('reports missing rooms and overlapping reservations', async () => {
    const baseUrl = await startServer({
        async createReservation({ salaId }) {
            const error = new Error('reservation rejected');
            error.code = salaId === 99 ? 'ROOM_NOT_FOUND' : 'RESERVATION_CONFLICT';
            error.message = salaId === 99 ? 'Sala não encontrada.' : 'Conflito de horário.';
            throw error;
        }
    });
    const reservation = {
        sala_id: 1,
        data_inicio: '2026-11-07T09:00',
        data_fim: '2026-11-07T10:00',
        responsavel: 'Ana Souza',
        finalidade: 'Reunião',
        quantidade_alunos: 10
    };

    const missingRoomResponse = await fetch(`${baseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reservation, sala_id: 99 })
    });
    assert.equal(missingRoomResponse.status, 404);

    const conflictResponse = await fetch(`${baseUrl}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
    });
    assert.equal(conflictResponse.status, 409);
});
