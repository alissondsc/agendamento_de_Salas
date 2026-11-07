# Backend

API Node.js separada do frontend, com conexão MySQL via pool e banco local em Docker.

## Preparar ambiente

1. Copie `.env.example` para `.env` e ajuste as credenciais se necessário.
2. Inicie o banco: `docker compose up -d mysql`. Na primeira inicializacao, o
   Docker cria as tabelas `salas` e `reservas` e insere tres salas e cinco
   reservas de exemplo a partir de `database/init/001_schema_and_seed.sql`.
3. Instale as dependências: `npm install`.
4. Inicie a API em modo de desenvolvimento: `npm run dev`.
5. Execute os testes: `npm test`.

A API fica disponível em `http://localhost:3000`. O endpoint `GET /api/health`
verifica a conexão com o MySQL e responde com `503` quando o banco não estiver
disponível. Configure `CORS_ORIGINS` no `.env` para autorizar a origem do servidor
estático do frontend. O cliente do frontend usa `http://localhost:3000/api` por padrão;
para outro ambiente, defina `window.RESERVE_ME_API_URL` antes de carregar `js/api.js`.

O cadastro em `POST /api/auth/register` cria uma conta com nome, e-mail e senha
(mínimo de 8 caracteres); a senha é armazenada com hash e salt. O login é feito
em `POST /api/auth/login`. A tabela `usuarios` é criada automaticamente quando a
API inicia, inclusive em volumes MySQL existentes.

Após entrar, a tela `frontend/reservas.html` permite consultar as salas e
solicitar reservas. A API lista salas em `GET /api/salas`, lista reservas em
`GET /api/reservas` e cria solicitações pendentes em `POST /api/reservas`.
O banco valida a lotação e impede sobreposição de horários em uma mesma sala;
reservas canceladas não bloqueiam um novo horário, inclusive quando o banco já
tinha a restrição de horário único. A API atualiza esse índice e adiciona a
coluna de quantidade de alunos automaticamente em bancos locais já existentes.

As credenciais padrão do Compose são somente para desenvolvimento local; não as
utilize em ambientes compartilhados ou de produção.

Os recursos de cada sala são armazenados como uma lista JSON. As situacoes
permitidas para reservas sao `cancelada`, `aprovada` e `pendente`. O script de
inicializacao nao apaga nem substitui dados existentes. Scripts da pasta de
inicializacao do MySQL sao executados automaticamente somente quando o volume
do banco e criado pela primeira vez.

A funcao `cabeNaSala(quantidadeAlunos, salaId, salas)` verifica se uma turma
cabe na capacidade da sala. Retorna `false` se a sala nao existir ou nao
tiver capacidade suficiente e rejeita entradas invalidas com erro.
