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

As credenciais padrão do Compose são somente para desenvolvimento local; não as
utilize em ambientes compartilhados ou de produção.

Os recursos de cada sala são armazenados como uma lista JSON. As situacoes
permitidas para reservas sao `cancelada`, `aprovada` e `pendente`. O script de
inicializacao nao apaga nem substitui dados existentes. Scripts da pasta de
inicializacao do MySQL sao executados automaticamente somente quando o volume
do banco e criado pela primeira vez.
