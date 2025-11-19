# Deploy com Docker

Estas instruções sobem banco de dados PostgreSQL, API FastAPI e frontend estático do SIGEPRE usando Docker Compose.

## Pré-requisitos

- Docker 24+ e Docker Compose Plugin 2.20+ instalados no servidor.
- Porta 5433 (PostgreSQL), 8000 (API) e 8080 (frontend) liberadas ou ajustadas conforme necessário.

## Preparar variáveis de ambiente

1. Copie o arquivo de exemplo (`backend/.env`) e ajuste para produção (senhas fortes, `APP_ENV=prod`, `AUTH_DISABLED=false` para reativar o login real).
2. O Compose carrega esse arquivo via `env_file`, portanto mantenha-o em `backend/.env` ou atualize o caminho no `docker-compose.yml`.
3. Não use `localhost` como `DATABASE_HOST`; o Compose já sobrescreve com `db`, mas mantenha as outras variáveis coerentes.

## Build e execução

```bash
docker compose build
docker compose up -d
```

Serviços incluídos no `docker-compose.yml`:

- `db`: PostgreSQL 15 com volume persistente `postgres_data` e porta exposta `5433`.
- `backend`: FastAPI servido por Uvicorn na porta `8000`. O container lê `backend/.env` e usa `db` como host do banco.
- `frontend`: Nginx servindo `index.html`, `app.js` e `styles.css` na porta `8080`.

## Verificações

- `docker compose ps` deve mostrar os 3 serviços como `running`.
- Teste a API: `curl http://localhost:8000/health`.
- Acesse o frontend em `http://localhost:8080` e confirme se as requisições chegam ao backend.

## Comandos úteis

- Logs em tempo real: `docker compose logs -f backend` (troque pelo serviço desejado).
- Reiniciar após mudanças no código: `docker compose up -d --build`.
- Parar tudo: `docker compose down` (adicione `-v` para remover os volumes, inclusive o banco).

> Importante: para expor o sistema publicamente configure HTTPS (por exemplo usando um proxy reverso Traefik/Caddy) e mantenha `AUTH_DISABLED=false` para exigir login real.
