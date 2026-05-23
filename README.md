# data-vault

Secure JSON record-storage API with an Angular admin UI.

## Run the app

You can run this project in two ways:

- **With Docker** (everything in containers)
- **Without Docker** (run backend + frontend directly on your machine)

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB 7 (for non-Docker mode)
- Docker Desktop (for Docker mode)

---

### Option 1A: With Docker (production-like)

From the repository root:

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
docker compose up --build
```

App URLs:

- UI: http://localhost:4200
- API (through UI proxy): http://localhost:4200/api

To stop:

```bash
docker compose down
```

### Option 1B: With Docker + hot reload/debug (dev)

This mode keeps everything in Docker and gives you instant frontend/backend reloads while editing code.

From the repository root:

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
docker compose -f docker-compose.dev.yml up
```

App URLs:

- UI (Angular dev server): http://localhost:4200
- Backend API: http://localhost:3000
- API via frontend proxy: http://localhost:4200/api
- Backend debugger (Node inspector): localhost:9229

To stop:

```bash
docker compose -f docker-compose.dev.yml down
```

### Option 2: Without Docker (local dev)

1) Start MongoDB locally (must be reachable at `mongodb://localhost:27017/datavault`, or set `MONGO_URI` to your Mongo URL).

2) Create backend env file from the repository root:

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

3) Start backend (Terminal 1):

```bash
cd backend
npm ci
npm run start:dev
```

4) Start frontend (Terminal 2):

```bash
cd frontend
npm ci
npm start
```

App URLs:

- UI: http://localhost:4200
- Backend: http://localhost:3000
- API via frontend proxy: http://localhost:4200/api

### First-boot admin password

On first startup the backend seeds an `admin` user.

- If `ADMIN_BOOTSTRAP_PASSWORD` is set, that value is used as the initial password.
- If `ADMIN_BOOTSTRAP_PASSWORD` is empty, a random password is generated and printed once.
- Seeding is first-boot only (when the users collection is empty), so you will not see this message on later restarts.

Add these values to your `.env` (recommended):

```bash
ADMIN_BOOTSTRAP_PASSWORD=change-me-now
ADMIN_BOOTSTRAP_LOG_PASSWORD=false
```

`ADMIN_BOOTSTRAP_LOG_PASSWORD=true` prints the env password once at first boot. Keep it `false` for safer logs.

- **Docker mode**: get it from container logs:

```bash
docker compose logs backend | grep "Admin password"
```

- **Docker hot reload/debug mode**:

```bash
docker compose -f docker-compose.dev.yml logs backend | grep "Admin password"
```

- **Non-Docker mode**: read it from the backend terminal output.

If you do not see any first-boot password line, the admin user was likely already seeded earlier.
To force a fresh seed in Docker, remove volumes and start again:

```bash
docker compose down -v
docker compose up --build
```

Log in at http://localhost:4200/login with `admin` and that password, then change it in **Profile -> Change Password**.

---

## API Contract (external record access)

All record endpoints require two headers:

| Header | Value                                                 |
|---|-------------------------------------------------------|
| `x-api-token` | API token shown in the UI for the registered database |
| `x-database-id` | The database's MongoDB `_id`                               |

Token rollover: after rotating a token, both the newly issued token and the immediately previous token are accepted.

### Apps (JWT protected — must be logged into the UI)

| Method | Path | Description                                                     |
|---|---|-----------------------------------------------------------------|
| POST | /auth/login | Log in, returns `{ access_token }`                              |
| GET | /database | List all databases                                              |
| POST | /database | Create a new database                                               |
| PATCH | /database/:id | Update database metadata (e.g. description)                         |
| GET | /database/:id/token | Get the API token for a database                                    |
| POST | /database/:id/token/rotate | Rotate API token (previous token remains valid during rollover) |

### Records (API token protected)

| Method | Path | Description |
|---|---|---|
| POST | /records | Insert a record |
| GET | /records | Query records (`?tableId=`, `?createdBy=`) |
| GET | /records/:id | Get a single record by record `id` |
| PUT | /records/:id | Replace a record by record `id` |
| PATCH | /records/:id | Merge-update a record by record `id` |
| DELETE | /records/:id | Delete a record by record `id` |

### Record shape

```json
{
  "id": "users-001",
  "tableId": "my-table",
  "json": { "any": "data" },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "createdBy": "user-identifier"
}
```

### curl examples

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:4200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password>"}' | jq -r .access_token)

# Create a database
curl -X POST http://localhost:4200/api/apps \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-database"}'

# Insert a record
curl -X POST http://localhost:4200/api/records \
  -H "x-api-token: <api-token>" \
  -H "x-database-id: <database-id>" \
  -H "Content-Type: application/json" \
  -d '{"tableId":"users","json":{"name":"Alice"},"createdBy":"service-x"}'

# Query records by tableId
curl "http://localhost:4200/api/records?tableId=users" \
  -H "x-api-token: <api-token>" \
  -H "x-database-id: <database-id>"

# Query with multi-field JSON filters + sorting
FILTERS='[{"field":"json.status","op":"eq","value":"active"},{"field":"json.age","op":"gte","value":21}]'
SORT='[{"field":"json.lastName","dir":"asc"},{"field":"createdAt","dir":"desc"}]'
curl --get "http://localhost:4200/api/records" \
  --data-urlencode "logic=and" \
  --data-urlencode "filters=$FILTERS" \
  --data-urlencode "sort=$SORT" \
  --data-urlencode "limit=100" \
  -H "x-api-token: <api-token>" \
  -H "x-database-id: <database-id>"
```

---

## Changing the admin password via the UI

Log in → click **Profile** (top-right) → enter current + new password → **Save**.

## Stack

- **Backend**: NestJS 10 + Mongoose (MongoDB 7)
- **Frontend**: Angular 19 (standalone, no external UI lib)
- **Auth**: bcryptjs password hashing + JWT (admin UI), API-token header (record API)
- **Runtime**: Docker Compose

