# Deploy com Docker

Estas instruções sobem banco de dados PostgreSQL, API FastAPI e frontend estático do SIGEPRE usando Docker Compose e expõem o sistema através de um Traefik já existente (responsável por TLS/HTTPS).

## Pré-requisitos

- Docker 24+ e Docker Compose Plugin 2.20+ instalados no servidor.
- Um stack Traefik rodando (porta 80/443) com `providers.docker.exposedbydefault=false`, resolvers configurados (ex.: `mytlschallenge`) e o domínio `sigepre.mslestrategia.com.br` apontando para este host.
- Rede Docker externa `root_default` criada e compartilhada com o Traefik (`docker network create root_default` caso ainda não exista).

## Preparar variáveis de ambiente

1. Copie o arquivo de exemplo (`backend/.env`) e ajuste para produção (senhas fortes, `APP_ENV=prod`, `AUTH_DISABLED=false` para reativar o login real).
2. O Compose carrega esse arquivo via `env_file`, portanto mantenha-o em `backend/.env` ou atualize o caminho no `docker-compose.yml`.
3. Não use `localhost` como `DATABASE_HOST`; o Compose já sobrescreve com `db`, mas mantenha as outras variáveis coerentes.
4. Se quiser usar `AUTH_DISABLED=true` apenas em ambiente de testes, lembre-se de voltar para `false` em produção.

## Build e execução

```bash
docker compose build
docker compose up -d
```

Serviços incluídos no `docker-compose.yml`:

- `db`: PostgreSQL 15 com volume persistente `postgres_data`. Só expõe a porta `5432` internamente para a rede `internal`/`root_default`.
- `backend`: FastAPI servido por Uvicorn (porta interna `8000`). O Traefik roteia `https://sigepre.mslestrategia.com.br` para ele sempre que o caminho começar com `/api`, `/auth`, `/health` ou `/db-check`.
- `frontend`: Nginx servindo `index.html`, `app.js` e `styles.css` (porta interna `80`). O Traefik encaminha todas as outras rotas para este serviço.

## Verificações

- `docker compose ps` deve mostrar os 3 serviços como `running`.
- Teste a API a partir do container: `docker compose exec backend curl -fsS http://localhost:8000/health`.
- Acesse `https://sigepre.mslestrategia.com.br` (via Traefik) e confirme se o frontend carrega e consegue consumir a API.

## Comandos úteis

- Logs em tempo real: `docker compose logs -f backend` (troque pelo serviço desejado).
- Reiniciar após mudanças no código: `docker compose up -d --build`.
- Parar tudo: `docker compose down` (adicione `-v` para remover os volumes, inclusive o banco).

> Importante: mantenha `AUTH_DISABLED=false` em produção. Caso precise testar sem autenticação, altere temporariamente no `.env`, reinicie o container do backend e reverta em seguida.
