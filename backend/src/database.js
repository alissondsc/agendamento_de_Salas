import mysql from 'mysql2/promise';

export function createDatabase(config = process.env) {
    const requiredVariables = [
        'MYSQL_HOST',
        'MYSQL_DATABASE',
        'MYSQL_USER',
        'MYSQL_PASSWORD'
    ];

    const missingVariables = requiredVariables.filter((name) => !config[name]);
    if (missingVariables.length > 0) {
        throw new Error(`Variáveis de banco ausentes: ${missingVariables.join(', ')}`);
    }

    const pool = mysql.createPool({
        host: config.MYSQL_HOST,
        port: Number(config.MYSQL_PORT || 3306),
        database: config.MYSQL_DATABASE,
        user: config.MYSQL_USER,
        password: config.MYSQL_PASSWORD,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    return {
        async initialize() {
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    nome VARCHAR(120) NOT NULL,
                    email VARCHAR(254) NOT NULL,
                    senha_hash CHAR(128) NOT NULL,
                    senha_salt CHAR(32) NOT NULL,
                    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_usuarios_email (email)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            `);
            const [columns] = await pool.execute(
                `SELECT COLUMN_NAME
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'reservas'
                   AND COLUMN_NAME = 'quantidade_alunos'`
            );
            if (columns.length === 0) {
                await pool.execute(
                    'ALTER TABLE reservas ADD COLUMN quantidade_alunos SMALLINT UNSIGNED NOT NULL DEFAULT 1'
                );
            }
            const [reservationIndexes] = await pool.execute(
                `SELECT INDEX_NAME
                 FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'reservas'
                   AND INDEX_NAME = 'idx_reservas_sala_inicio'`
            );
            if (reservationIndexes.length === 0) {
                await pool.execute(
                    'CREATE INDEX idx_reservas_sala_inicio ON reservas (sala_id, data_inicio)'
                );
            }
            const [legacyIndexes] = await pool.execute(
                `SELECT INDEX_NAME
                 FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'reservas'
                   AND INDEX_NAME = 'uq_reservas_sala_inicio'
                   AND NON_UNIQUE = 0`
            );
            if (legacyIndexes.length > 0) {
                await pool.execute(
                    'ALTER TABLE reservas DROP INDEX uq_reservas_sala_inicio'
                );
            }
        },
        async ping() {
            await pool.execute('SELECT 1');
        },
        async createUser({ nome, email, senhaHash, senhaSalt }) {
            const [result] = await pool.execute(
                'INSERT INTO usuarios (nome, email, senha_hash, senha_salt) VALUES (?, ?, ?, ?)',
                [nome, email, senhaHash, senhaSalt]
            );

            return {
                id: String(result.insertId),
                nome,
                email
            };
        },
        async findUserByEmail(email) {
            const [rows] = await pool.execute(
                'SELECT id, nome, email, senha_hash, senha_salt FROM usuarios WHERE email = ? LIMIT 1',
                [email]
            );

            return rows[0] ?? null;
        },
        async listRooms() {
            const [rows] = await pool.execute(
                'SELECT id, nome, andar, capacidade, recursos FROM salas ORDER BY nome'
            );

            return rows.map((room) => ({
                ...room,
                id: String(room.id),
                recursos: typeof room.recursos === 'string'
                    ? JSON.parse(room.recursos)
                    : room.recursos
            }));
        },
        async listReservations() {
            const [rows] = await pool.execute(
                `SELECT reservas.id, reservas.sala_id, salas.nome AS sala_nome,
                        reservas.data_inicio, reservas.data_fim,
                        reservas.responsavel, reservas.finalidade,
                        reservas.quantidade_alunos, reservas.situacao
                 FROM reservas
                 INNER JOIN salas ON salas.id = reservas.sala_id
                 ORDER BY reservas.data_inicio DESC, reservas.id DESC`
            );

            return rows.map((reservation) => ({
                ...reservation,
                id: String(reservation.id),
                sala_id: String(reservation.sala_id)
            }));
        },
        async createReservation({
            salaId,
            dataInicio,
            dataFim,
            responsavel,
            finalidade,
            quantidadeAlunos
        }) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [rooms] = await connection.execute(
                    'SELECT capacidade FROM salas WHERE id = ? FOR UPDATE',
                    [salaId]
                );
                if (rooms.length === 0) {
                    const error = new Error('Sala não encontrada.');
                    error.code = 'ROOM_NOT_FOUND';
                    throw error;
                }

                if (quantidadeAlunos > rooms[0].capacidade) {
                    const error = new Error('A turma excede a capacidade da sala.');
                    error.code = 'ROOM_CAPACITY_EXCEEDED';
                    throw error;
                }

                const [conflicts] = await connection.execute(
                    `SELECT id FROM reservas
                     WHERE sala_id = ?
                       AND situacao <> 'cancelada'
                       AND data_inicio < ?
                       AND data_fim > ?
                     LIMIT 1`,
                    [salaId, dataFim, dataInicio]
                );
                if (conflicts.length > 0) {
                    const error = new Error('A sala já possui uma reserva nesse horário.');
                    error.code = 'RESERVATION_CONFLICT';
                    throw error;
                }

                const [result] = await connection.execute(
                    `INSERT INTO reservas (
                        sala_id, data_inicio, data_fim, responsavel,
                        finalidade, quantidade_alunos, situacao
                    ) VALUES (?, ?, ?, ?, ?, ?, 'pendente')`,
                    [
                        salaId,
                        dataInicio,
                        dataFim,
                        responsavel,
                        finalidade,
                        quantidadeAlunos
                    ]
                );
                await connection.commit();
                return { id: String(result.insertId) };
            } catch (error) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('Falha ao reverter a transação da reserva:', rollbackError);
                }
                throw error;
            } finally {
                connection.release();
            }
        },
        close() {
            return pool.end();
        }
    };
}
