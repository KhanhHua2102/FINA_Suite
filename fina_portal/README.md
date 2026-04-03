# FINA Suite Portal

A web-based dashboard for monitoring and controlling the FINA Suite financial analysis system.

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm

## Project Structure

```
fina_portal/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── services/     # Business logic
│   │   ├── config.py     # Configuration
│   │   └── main.py       # Application entry
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── store/
│   ├── Dockerfile
│   └── package.json
├── nginx/                # Nginx config (production)
├── venv/                 # Python virtual environment
├── docker-compose.yml
└── README.md
```

## Local Development

### 1. Backend Setup

```bash
cd fina_portal

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run the backend server
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

The API will be available at `http://localhost:8001`.

### 2. Frontend Setup

Open a new terminal:

```bash
cd fina_portal/frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### 3. Environment Configuration

Create API credential files in the project root directory and configure environment variables with the `FS_` prefix in the `.env` file.

## Quick Start

From the project root:

```bash
./run.sh
```

This starts both backend and frontend in one terminal. Press Ctrl+C to stop.

## Running Services Manually

**Terminal 1 (Backend):**
```bash
cd fina_portal
source venv/bin/activate
cd backend
uvicorn app.main:app --reload --port 8001
```

**Terminal 2 (Frontend):**
```bash
cd fina_portal/frontend
npm run dev
```

## Docker Deployment

### Development (without nginx)

```bash
cd fina_portal

# Build and run backend + frontend
docker-compose up backend frontend
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

### Production (with nginx reverse proxy)

```bash
cd fina_portal

# Build and run all services including nginx
docker-compose --profile production up -d
```

- Application: `http://localhost` (port 80)
- HTTPS: `https://localhost` (port 443, requires SSL cert setup)

### Docker Environment Variables

The docker-compose.yml mounts the project directory and sets:
- `FS_PROJECT_DIR=/project` - Path to project root inside container
- `FS_HUB_DATA_DIR=/project/data/runtime` - Runtime data directory

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/settings` | Application settings |
| `GET /api/portfolio` | Portfolio management |
| `GET /api/charts/candles/{ticker}` | Price candles |
| `WS /api/ws` | WebSocket for real-time updates |

## Troubleshooting

### Port Already in Use

```bash
# Find the process using the port
lsof -i :8001

# Kill it or use a different port
uvicorn app.main:app --reload --port 8002
```

Then update `frontend/vite.config.ts` to proxy to the new port.

### Rate Limit Errors

If you see rate limit errors, wait a minute and retry. The backend has built-in retry logic with exponential backoff.
