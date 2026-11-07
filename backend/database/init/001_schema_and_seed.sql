CREATE TABLE IF NOT EXISTS salas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome VARCHAR(120) NOT NULL,
    andar SMALLINT NOT NULL,
    capacidade SMALLINT UNSIGNED NOT NULL,
    recursos JSON NOT NULL,
    criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_salas_nome (nome),
    CONSTRAINT chk_salas_capacidade CHECK (capacidade > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reservas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sala_id BIGINT UNSIGNED NOT NULL,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME NOT NULL,
    responsavel VARCHAR(160) NOT NULL,
    finalidade VARCHAR(500) NOT NULL,
    quantidade_alunos SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    situacao ENUM('cancelada', 'aprovada', 'pendente') NOT NULL DEFAULT 'pendente',
    criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reservas_sala_inicio (sala_id, data_inicio),
    KEY idx_reservas_data (data_inicio, data_fim),
    KEY idx_reservas_situacao (situacao),
    CONSTRAINT fk_reservas_salas
        FOREIGN KEY (sala_id) REFERENCES salas (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_reservas_periodo CHECK (data_fim > data_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    senha_hash CHAR(128) NOT NULL,
    senha_salt CHAR(32) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO salas (nome, andar, capacidade, recursos)
SELECT 'Sala Horizonte', 1, 30, JSON_ARRAY('Projetor', 'Quadro branco', 'Ar-condicionado')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM salas WHERE nome = 'Sala Horizonte')
UNION ALL
SELECT 'Sala Inovacao', 2, 20, JSON_ARRAY('Projetor', 'Computadores', 'Ar-condicionado')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM salas WHERE nome = 'Sala Inovacao')
UNION ALL
SELECT 'Sala Colaborativa', 1, 12, JSON_ARRAY('TV', 'Videoconferencia', 'Quadro branco')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM salas WHERE nome = 'Sala Colaborativa');

INSERT INTO reservas (
    sala_id,
    data_inicio,
    data_fim,
    responsavel,
    finalidade,
    situacao
)
SELECT salas.id, '2026-11-02 08:00:00', '2026-11-02 09:30:00',
       'Ana Souza', 'Reuniao de planejamento pedagogico', 'aprovada'
FROM salas
WHERE salas.nome = 'Sala Horizonte'
  AND NOT EXISTS (
      SELECT 1 FROM reservas
      WHERE sala_id = salas.id AND data_inicio = '2026-11-02 08:00:00'
  )
UNION ALL
SELECT salas.id, '2026-11-02 10:00:00', '2026-11-02 12:00:00',
       'Bruno Lima', 'Aula de introducao a programacao', 'pendente'
FROM salas
WHERE salas.nome = 'Sala Inovacao'
  AND NOT EXISTS (
      SELECT 1 FROM reservas
      WHERE sala_id = salas.id AND data_inicio = '2026-11-02 10:00:00'
  )
UNION ALL
SELECT salas.id, '2026-11-03 14:00:00', '2026-11-03 15:00:00',
       'Carla Mendes', 'Atendimento individual aos estudantes', 'aprovada'
FROM salas
WHERE salas.nome = 'Sala Colaborativa'
  AND NOT EXISTS (
      SELECT 1 FROM reservas
      WHERE sala_id = salas.id AND data_inicio = '2026-11-03 14:00:00'
  )
UNION ALL
SELECT salas.id, '2026-11-04 09:00:00', '2026-11-04 11:00:00',
       'Diego Alves', 'Oficina de ciencias', 'pendente'
FROM salas
WHERE salas.nome = 'Sala Horizonte'
  AND NOT EXISTS (
      SELECT 1 FROM reservas
      WHERE sala_id = salas.id AND data_inicio = '2026-11-04 09:00:00'
  )
UNION ALL
SELECT salas.id, '2026-11-05 13:30:00', '2026-11-05 15:00:00',
       'Elisa Rocha', 'Capacitacao de equipe', 'cancelada'
FROM salas
WHERE salas.nome = 'Sala Inovacao'
  AND NOT EXISTS (
      SELECT 1 FROM reservas
      WHERE sala_id = salas.id AND data_inicio = '2026-11-05 13:30:00'
  );
