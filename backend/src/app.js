import cors from 'cors';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { promisify } from 'node:util';

const derivePasswordHash = promisify(scrypt);

function validarCadastro({ nome, email, senha }) {
    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 120) {
        return 'Informe um nome com pelo menos 2 caracteres.';
    }

    if (
        typeof email !== 'string'
        || email.length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        return 'Informe um e-mail válido.';
    }

    if (typeof senha !== 'string' || senha.length < 8 || senha.length > 128) {
        return 'A senha deve ter entre 8 e 128 caracteres.';
    }

    return null;
}

function formatarDataHora(valor) {
    if (
        typeof valor !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)
    ) {
        return null;
    }

    const [data, horario] = valor.split('T');
    const [ano, mes, dia] = data.split('-').map(Number);
    const [hora, minuto] = horario.split(':').map(Number);
    const dataValidada = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));

    if (
        dataValidada.getUTCFullYear() !== ano
        || dataValidada.getUTCMonth() !== mes - 1
        || dataValidada.getUTCDate() !== dia
        || hora > 23
        || minuto > 59
    ) {
        return null;
    }

    return `${data} ${horario}:00`;
}

async function criarHashSenha(senha, salt = randomBytes(16).toString('hex')) {
    const hash = await derivePasswordHash(senha, salt, 64);
    return { hash: hash.toString('hex'), salt };
}

async function verificarSenha(senha, senhaHash, senhaSalt) {
    const { hash } = await criarHashSenha(senha, senhaSalt);
    const hashArmazenado = Buffer.from(senhaHash, 'hex');
    const hashInformado = Buffer.from(hash, 'hex');

    return hashArmazenado.length === hashInformado.length
        && timingSafeEqual(hashArmazenado, hashInformado);
}

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

    app.post('/api/auth/register', async (request, response) => {
        const { nome, email, senha } = request.body ?? {};
        const validationError = validarCadastro({ nome, email, senha });
        if (validationError) {
            response.status(400).json({ error: validationError });
            return;
        }

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const { hash, salt } = await criarHashSenha(senha);
            const user = await database.createUser({
                nome: nome.trim(),
                email: normalizedEmail,
                senhaHash: hash,
                senhaSalt: salt
            });
            response.status(201).json({ user });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                response.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
                return;
            }

            console.error('Falha ao criar conta:', error);
            response.status(500).json({ error: 'Não foi possível criar a conta.' });
        }
    });

    app.post('/api/auth/login', async (request, response) => {
        const { email, senha } = request.body ?? {};
        if (
            typeof email !== 'string'
            || email.trim().length === 0
            || email.length > 254
            || typeof senha !== 'string'
            || senha.length === 0
            || senha.length > 128
        ) {
            response.status(400).json({ error: 'Informe e-mail e senha.' });
            return;
        }

        try {
            const user = await database.findUserByEmail(email.trim().toLowerCase());
            if (
                !user
                || !(await verificarSenha(senha, user.senha_hash, user.senha_salt))
            ) {
                response.status(401).json({ error: 'E-mail ou senha incorretos.' });
                return;
            }

            response.status(200).json({
                user: {
                    id: String(user.id),
                    nome: user.nome,
                    email: user.email
                }
            });
        } catch (error) {
            console.error('Falha ao autenticar conta:', error);
            response.status(500).json({ error: 'Não foi possível entrar.' });
        }
    });

    app.get('/api/salas', async (request, response) => {
        try {
            response.status(200).json({ salas: await database.listRooms() });
        } catch (error) {
            console.error('Falha ao consultar salas:', error);
            response.status(500).json({ error: 'Não foi possível carregar as salas.' });
        }
    });

    app.get('/api/reservas', async (request, response) => {
        try {
            response.status(200).json({
                reservas: await database.listReservations()
            });
        } catch (error) {
            console.error('Falha ao consultar reservas:', error);
            response.status(500).json({ error: 'Não foi possível carregar as reservas.' });
        }
    });

    app.post('/api/reservas', async (request, response) => {
        const {
            sala_id: salaId,
            data_inicio: inicioInput,
            data_fim: fimInput,
            responsavel,
            finalidade,
            quantidade_alunos: quantidadeAlunos
        } = request.body ?? {};

        const dataInicio = formatarDataHora(inicioInput);
        const dataFim = formatarDataHora(fimInput);
        const parsedSalaId = typeof salaId === 'string' && /^\d+$/.test(salaId)
            ? Number(salaId)
            : salaId;

        if (!Number.isSafeInteger(parsedSalaId) || parsedSalaId < 1) {
            response.status(400).json({ error: 'Selecione uma sala válida.' });
            return;
        }
        if (!dataInicio || !dataFim || dataInicio >= dataFim) {
            response.status(400).json({
                error: 'Informe uma data e horários válidos; o fim deve ser posterior ao início.'
            });
            return;
        }
        if (
            typeof responsavel !== 'string'
            || responsavel.trim().length < 2
            || responsavel.trim().length > 160
        ) {
            response.status(400).json({ error: 'Informe o nome do responsável.' });
            return;
        }
        if (
            typeof finalidade !== 'string'
            || finalidade.trim().length < 2
            || finalidade.trim().length > 500
        ) {
            response.status(400).json({ error: 'Informe a finalidade da reserva.' });
            return;
        }
        if (!Number.isInteger(quantidadeAlunos) || quantidadeAlunos < 1 || quantidadeAlunos > 65535) {
            response.status(400).json({ error: 'Informe uma quantidade de alunos válida.' });
            return;
        }

        try {
            const reservation = await database.createReservation({
                salaId: parsedSalaId,
                dataInicio,
                dataFim,
                responsavel: responsavel.trim(),
                finalidade: finalidade.trim(),
                quantidadeAlunos
            });
            response.status(201).json({ reserva: reservation });
        } catch (error) {
            if (error.code === 'ROOM_NOT_FOUND') {
                response.status(404).json({ error: error.message });
                return;
            }
            if (
                error.code === 'ROOM_CAPACITY_EXCEEDED'
                || error.code === 'RESERVATION_CONFLICT'
            ) {
                response.status(409).json({ error: error.message });
                return;
            }

            console.error('Falha ao criar reserva:', error);
            response.status(500).json({ error: 'Não foi possível criar a reserva.' });
        }
    });

    return app;
}
