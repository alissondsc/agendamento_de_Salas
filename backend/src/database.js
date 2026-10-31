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
        async ping() {
            await pool.execute('SELECT 1');
        },
        close() {
            return pool.end();
        }
    };
}
