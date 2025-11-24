# Revisão do sistema SIGEPRE

## Visão geral
- Backend em FastAPI/SQLAlchemy com JWT, controle de papéis e CRUD de clientes, secretarias, tipos e peças (armazenando comprovantes em base64).
- Frontend estático (HTML/CSS/JS vanilla) servido por Nginx; autentica via token em `localStorage` e consome a API via `fetch`.
- Orquestração via Docker (backend/frontend) e Caddy; documentação cita um Postgres em Compose, mas o arquivo atual depende de um banco externo.

## Achados principais (alta prioridade)
- Credenciais reais e segredo JWT versionados (`backend/.env`:1-13). Devem ser removidos do repositório e rotacionados imediatamente.
- CORS totalmente aberto com cookies habilitados (`backend/app/main.py`:29-35) e interruptor `AUTH_DISABLED` que devolve um usuário master falso (`backend/app/core/security.py`:47-90). Qualquer origem consegue chamar a API e um deslize de configuração derruba toda a autenticação.
- Upload/armazenamento de comprovantes em base64 sem validação no backend (`backend/app/routers/pecas.py`:85-103,161-208; modelo permite texto arbitrário em `backend/app/models/pecas.py`:13-23). Um POST malicioso pode gravar blobs enormes e eles são devolvidos integralmente em todas as respostas.
- Listagem e relatório retornam todas as peças sem paginação e incluem o base64 completo (`backend/app/routers/pecas.py`:106-141; `app.js`:396-536), expondo o sistema a tempos de resposta altíssimos e consumo de banda/memória.
- Campos textuais são injetados com `innerHTML` sem sanitização (`app.js`:375-504,648-656). Basta gravar `<script>` em observação ou nomes para executar XSS e roubar o token do `localStorage`.
- Exclusões não tratam as FKs `RESTRICT`: deletar clientes/secretarias com peças gera erro 500 em vez de resposta amigável (`backend/app/models/pecas.py`:13-23; `backend/app/routers/clientes.py`:27-42; `backend/app/routers/secretarias.py`:22-57).
- Compose não provisiona Postgres e depende de `host.docker.internal` (`docker-compose.yml`:3-32), enquanto o guia promete um serviço `db` (`DEPLOYMENT.md`:25-29); dificulta reprodução e acopla o deploy a um host específico.

## Observações adicionais
- Sem rate limiting ou logging de tentativas em `/auth/login` (`backend/app/routers/auth.py`), permitindo brute force.
- `allow_credentials=True` com `allow_origins=["*"]` é inválido para navegadores; defina origens explícitas.
- `/health` expõe `authDisabled`, facilitando reconhecimento de ambiente; oculte em produção.
- Não há migrations/`alembic upgrade` para criar o schema; exige DDL manual.
- Frontend assume `window.location.origin` como base da API; ao servir arquivos estaticamente pode apontar para a porta errada (Compose expõe backend em 2020).

## Recomendações imediatas
1. Remover `backend/.env` do controle de versão, revogar credenciais do Postgres e rotacionar `JWT_SECRET`; usar secrets/variáveis de ambiente no deploy.
2. Ajustar CORS para uma lista de origens confiáveis e garantir `AUTH_DISABLED=false` fora de desenvolvimento.
3. Validar uploads no backend (tipo/mime, tamanho, limite de base64) e considerar mover comprovantes para armazenamento externo com URLs assinadas.
4. Introduzir paginação e projeções que não incluam o base64 nas listagens/relatórios; carregar a imagem sob demanda.
5. Renderizar texto com `textContent`/escape ou sanitização e, se possível, armazenar o token em cookie HttpOnly para mitigar XSS.
6. Tratar deleção de clientes/secretarias com peças com erros 400/409 claros ou definir uma estratégia de cascade/soft delete.
7. Alinhar `docker-compose.yml` e `DEPLOYMENT.md`: provisionar Postgres (ou documentar a dependência externa) e adicionar migrations/seed de usuário inicial.
