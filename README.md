# POA Eventos 📍

**Mapa colaborativo e interativo de eventos urbanos em Porto Alegre.**

> Descubra e publique eventos fixados geograficamente no mapa — shows, feiras, corridas, festas e muito mais.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Django 5 + DRF + GeoDjango |
| Banco de dados | PostgreSQL 16 + PostGIS 3.4 |
| Cache / Queue | Redis 7 + Celery |
| Frontend | Vanilla JS + Mapbox GL JS + Three.js + Tailwind CSS |
| Infra | Docker Compose + Nginx + Certbot |

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- [Make](https://www.gnu.org/software/make/) (opcional, mas recomendado)
- Conta [Mapbox](https://account.mapbox.com/) (free tier)
- Conta [Google Cloud Console](https://console.cloud.google.com/) para OAuth (opcional)

---

## Setup rápido

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/poa-eventos.git
cd poa-eventos

# 2. Crie o arquivo .env a partir do exemplo
make env
# OU manualmente:
cp .env.example .env

# 3. Edite o .env com suas credenciais
#    (SECRET_KEY, MAPBOX tokens, Google OAuth, etc.)
nano .env

# 4. Build das imagens
make build

# 5. Sobe todos os serviços
make run

# 6. Roda as migrations
make migrate

# 7. Popula dados iniciais (categorias + cidade Porto Alegre)
make seed

# 8. Cria superusuário para o admin
make createsuperuser
```

A aplicação estará disponível em:
- **Frontend/API**: http://localhost (via Nginx) ou http://localhost:8000 (direto)
- **Admin Django**: http://localhost:8000/admin/

---

## Comandos `make`

| Comando | Descrição |
|---|---|
| `make run` | Sobe todos os containers em background |
| `make run-fg` | Sobe em foreground (logs visíveis) |
| `make stop` | Para todos os containers |
| `make build` | (Re)builda as imagens Docker |
| `make migrate` | Roda `python manage.py migrate` |
| `make makemigrations` | Cria novas migrations |
| `make createsuperuser` | Cria superusuário Django |
| `make shell` | Abre Django shell |
| `make seed` | Popula categorias + Porto Alegre |
| `make test` | Roda pytest |
| `make test-cov` | Pytest com relatório de cobertura |
| `make lint` | flake8 + isort check |
| `make format` | black + isort format |
| `make logs` | Logs do container `app` |
| `make psql` | Acessa o banco via psql |
| `make redis-cli` | Acessa o Redis CLI |

---

## API Endpoints

### Auth
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/register/` | Cadastro com e-mail + senha |
| POST | `/api/auth/login/` | Login → retorna access + refresh JWT |
| POST | `/api/auth/logout/` | Blacklista o refresh token |
| POST | `/api/auth/token/refresh/` | Renova o access token |
| GET/PATCH | `/api/auth/me/` | Dados e atualização do perfil |
| POST | `/api/auth/google/` | Login via Google OAuth2 |
| GET | `/api/auth/mapbox-token/` | Token público Mapbox para o frontend |

### Eventos
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/events/` | GeoJSON FeatureCollection de eventos publicados |
| POST | `/api/events/` | Cria evento (auth required) |
| GET | `/api/events/{id}/` | Detalhe do evento |
| PATCH | `/api/events/{id}/` | Atualiza evento (dono ou admin) |
| DELETE | `/api/events/{id}/` | Soft delete (dono ou admin) |
| POST | `/api/events/{id}/interact/` | GOING / INTERESTED / SAVED / REPORTED |
| GET | `/api/events/mine/` | Eventos do usuário logado |
| GET | `/api/events/nearby/?lat=&lng=&radius_km=` | Eventos próximos (PostGIS) |
| GET | `/api/events/search/?q=&category=&city=&...` | Busca com filtros |

### Query params para GET `/api/events/`
| Param | Tipo | Exemplo |
|---|---|---|
| `category` | slug | `show-musica` |
| `city` | slug | `porto-alegre` |
| `start_date` | YYYY-MM-DD | `2026-03-01` |
| `end_date` | YYYY-MM-DD | `2026-03-31` |
| `is_free` | bool | `true` |
| `bbox` | minLng,minLat,maxLng,maxLat | `-51.27,-30.23,-51.05,-30.00` |

---

## Estrutura do projeto

```
poa-eventos/
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py          # Configurações compartilhadas
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── celery.py            # App Celery + Beat schedule
│   │   ├── middleware.py        # Security headers middleware
│   │   └── urls.py
│   ├── apps/
│   │   ├── accounts/            # Custom User, UserProfile, JWT Auth
│   │   ├── events/              # Category, Event, EventInteraction, EventHistory
│   │   └── cities/              # City com PostGIS bounding box
│   ├── conftest.py              # Fixtures pytest
│   ├── pytest.ini
│   ├── setup.cfg                # flake8 + isort config
│   ├── pyproject.toml           # black config
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html
│   ├── styles/
│   │   └── main.css
│   └── src/
│       ├── app.js               # Bootstrap — coordena todos os módulos
│       ├── map.js               # Mapbox GL JS
│       ├── pins.js              # Three.js 3D markers
│       ├── auth.js              # JWT auth + modal de login
│       ├── events.js            # CRUD de eventos + modal de criação
│       └── filters.js           # Filtros de categoria, data, etc.
├── nginx/
│   └── default.conf
├── docker-compose.yml
├── Makefile
├── .env.example
└── .gitignore
```

---

## Segurança implementada

- JWT com access token de 15min + refresh de 7 dias com blacklist no logout
- Rate limiting: 5 tentativas de login por minuto por IP
- Validação de bounding box: pins fora da cidade são rejeitados com HTTP 400
- Upload de imagens: validação de MIME real (via `python-magic`), limite 5MB, auto-resize via Pillow
- CORS configurável via `.env`
- Security headers via middleware customizado (CSP, HSTS, X-Frame-Options, etc.)
- Soft delete: eventos nunca são removidos do banco (`deleted_at`)
- Moderação: eventos de novos usuários ficam em `DRAFT` até aprovação admin
- Denúncias: após 5 reports, evento vai automaticamente para revisão

---

## Tarefas Celery (agendadas)

| Task | Schedule | Descrição |
|---|---|---|
| `expire_old_events` | A cada hora | Marca como `EXPIRED` eventos com `end_datetime` no passado |
| `send_event_reminders` | Diariamente 09:00 UTC | E-mail de lembrete 24h antes para GOING/INTERESTED |
| `increment_view_count` | Assíncrono (on-demand) | Incrementa `view_count` sem bloquear o request |
| `notify_event_published` | On-demand (admin action) | Notifica organizador que evento foi aprovado |

---

## Deploy gratuito recomendado

**Railway** (recomendado para começar):
```
Railway Project
├── Service: Django App (via Dockerfile)
├── Service: PostgreSQL com PostGIS
└── Service: Redis
```

Ver [ANÁLISE DE HOSPEDAGEM](./HOSTING.md) para comparativo detalhado de opções gratuitas.

---

## Desenvolvimento local sem Docker

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt

# Precisa de PostgreSQL com PostGIS instalado localmente
python manage.py migrate
python manage.py seed_categories
python manage.py seed_porto_alegre
python manage.py runserver
```

---

## Testes

```bash
make test          # roda pytest
make test-cov      # com relatório de cobertura HTML em htmlcov/
```

Cobertura de testes inclui:
- Autenticação: registro, login, logout, refresh, me endpoint
- Eventos: CRUD, filtros geoespaciais, bounding box validation, soft delete, interações, nearby
- Permissões: owner-only edits, auth required, admin actions

---

## Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m "feat: descrição da feature"`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## Licença

MIT
