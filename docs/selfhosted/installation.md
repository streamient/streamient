# Installation

## Running with Docker Compose

```bash
curl -O https://raw.githubusercontent.com/streamient/streamient/main/compose.prod.yml

APP_URL=https://your-instance.com \
SESSION_SECRET=your-session-secret \
JWT_SECRET=your-jwt-secret \
TYPESENSE_API_KEY=your-typesense-key \
SMTP_HOST=smtp.example.com \
SMTP_USER=you@example.com \
SMTP_PASS=your-smtp-password \
SMTP_FROM=noreply@example.com \
GOOGLE_API_KEY=your-google-api-key \
docker compose -f compose.prod.yml up -d
```

The app will be available at your configured `APP_URL`.

## Services

| Service    | Port  | Description                   |
| ---------- | ----- | ----------------------------- |
| App        | 3000  | Main Express application      |
| WebSocket  | 3001  | Real-time updates             |
| MCP Server | 3002  | Model Context Protocol server |
| MongoDB    | 27017 | Database                      |
| Redis      | 6379  | Caching & pub/sub             |
| Typesense  | 8108  | Full-text & vector search     |

## Environment Variables

See [Configuration](/selfhosted/configuration) for the full list. Key variables:

| Variable         | Description                                  |
| ---------------- | -------------------------------------------- |
| `MONGO_URI`      | MongoDB connection string                    |
| `REDIS_URL`      | Redis connection string                      |
| `SESSION_SECRET` | Express session secret                       |
| `JWT_SECRET`     | JWT signing secret                           |
| `APP_URL`        | Public URL of the application                |
| `TYPESENSE_API_KEY` | Typesense API key                         |
| `GOOGLE_API_KEY` | Google AI API key                            |
| `OPENAI_API_KEY` | OpenAI API key                               |

## Local Development

```bash
pnpm install
pnpm dev
```

This starts the app with `nodemon` for auto-reload on file changes.

## Building Assets

```bash
pnpm build
```

Builds frontend assets (vendor.js, admin_vendor.css, editor.js, graph_bundle.js) with esbuild.
