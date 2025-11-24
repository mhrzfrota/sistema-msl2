# Deploy com Docker

Estas instruções sobem banco de dados PostgreSQL, API FastAPI e frontend estático do SIGEPRE usando Docker Compose (e podem ser expostas por um proxy como Traefik/Caddy).

## Pré-requisitos

- Docker 24+ e Docker Compose Plugin 2.20+ instalados no servidor.
- Um stack Traefik rodando (porta 80/443) com `providers.docker.exposedbydefault=false`, resolvers configurados (ex.: `mytlschallenge`) e o domínio `sigepre.mslestrategia.com.br` apontando para este host.
- Rede Docker externa `root_default` criada e compartilhada com o Traefik (`docker network create root_default` caso ainda não exista).

## Preparar variáveis de ambiente

1. Copie o arquivo de exemplo: `cp backend/.env.example backend/.env`.
2. Ajuste as credenciais do Postgres (`POSTGRES_*`/`DATABASE_*`), `JWT_SECRET` forte e defina `AUTH_DISABLED=false` em produção.
3. Configure `ALLOWED_ORIGINS` com as origens que podem chamar a API (ex.: `http://localhost:2021,https://sigepre.mslestrategia.com.br`).
4. `APP_ENV=prod` em produção; `DATABASE_HOST` deve ser `db` (serviço interno do Compose).
5. O arquivo `backend/.env` está no `.gitignore`; mantenha-o fora do versionamento e rotacione segredos que já tenham sido expostos.

## Build e execução

```bash
docker compose build
docker compose up -d
```

Serviços incluídos no `docker-compose.yml`:

- `db`: PostgreSQL 15 com volume persistente `postgres_data`. Usa variáveis do `backend/.env` e fica acessível apenas pela rede interna.
- `backend`: FastAPI servido por Uvicorn (porta interna `8000`), com CORS controlado por `ALLOWED_ORIGINS`.
- `frontend`: Nginx servindo `index.html`, `app.js` e `styles.css` (porta interna `80`).

## Verificações

- `docker compose ps` deve mostrar os 3 serviços como `running`.
- Teste a API a partir do container: `docker compose exec backend curl -fsS http://localhost:8000/health`.
- Acesse `http://localhost:2021` (ou o domínio no proxy) e confirme se o frontend carrega e consegue consumir a API.

## Comandos úteis

- Logs em tempo real: `docker compose logs -f backend` (troque pelo serviço desejado).
- Reiniciar após mudanças no código: `docker compose up -d --build`.
- Parar tudo: `docker compose down` (adicione `-v` para remover os volumes, inclusive o banco).

> Importante: mantenha `AUTH_DISABLED=false` em produção. Caso precise testar sem autenticação, altere temporariamente no `.env`, reinicie o container do backend e reverta em seguida. Rotate o `JWT_SECRET` e senhas se o `.env` antigo já tiver sido publicado.
