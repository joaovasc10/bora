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
| Frontend | Vanilla JS + Mapbox GL JS + Tailwind CSS |
| Infra | Docker Compose + Nginx + Certbot |

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

### Query params para `GET /api/events/`
| Param | Tipo | Exemplo |
|---|---|---|
| `category` | slug | `show-musica` |
| `city` | slug | `porto-alegre` |
| `start_date` | YYYY-MM-DD | `2026-03-01` |
| `end_date` | YYYY-MM-DD | `2026-03-31` |
| `is_free` | bool | `true` |
| `bbox` | minLng,minLat,maxLng,maxLat | `-51.27,-30.23,-51.05,-30.00` |

---

## Segurança

- JWT com access token de 15min + refresh de 7 dias com blacklist no logout
- Rate limiting: 5 tentativas de login por minuto por IP
- Upload de imagens: validação de MIME real (via `python-magic`), limite 5 MB, auto-resize via Pillow
- CORS configurável via variáveis de ambiente
- Security headers via middleware customizado (CSP, HSTS, X-Frame-Options, etc.)
- Soft delete: eventos nunca são removidos do banco (`deleted_at`)
- Denúncias: após 5 reports, evento vai automaticamente para revisão

---

## Tarefas Celery

| Task | Schedule | Descrição |
|---|---|---|
| `expire_old_events` | A cada hora | Marca como `EXPIRED` eventos com `end_datetime` no passado |
| `increment_view_count` | On-demand | Incrementa `view_count` sem bloquear o request |
| `notify_event_published` | On-demand | Notifica organizador que evento foi aprovado |
