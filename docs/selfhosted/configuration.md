# Configuration

All configuration is managed through environment variables in `compose.prod.yml`. The recommended approach is to use the production Compose file from the [GitHub repository](https://github.com/streamient/streamient) and set your secrets via shell environment or a Docker secrets workflow.

## Compose File

The `compose.prod.yml` file defines all services and their environment variables. Variables use the `${VAR:-default}` syntax — values without defaults are required.

Grab the latest version from GitHub:

```bash
curl -O https://raw.githubusercontent.com/streamient/streamient/main/compose.prod.yml
```

Then start the stack:

```bash
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

## Environment Variables

### Application

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `APP_URL` | Public URL of the application | Yes | — |
| `WS_URL` | Public WebSocket URL. Set this when the WebSocket server runs on a different host or port than the app | No | Same as `APP_URL` |
| `PORT` | Application port | No | `3000` |
| `SESSION_SECRET` | Express session secret | Yes | — |
| `JWT_SECRET` | JWT signing secret | Yes | — |
| `NODE_ENV` | Environment mode | No | `production` |
| `SERVER_MODE` | Run mode: omit for full app, `ws` for WebSocket-only, `scheduler` for background jobs | No | — |
| `SOCKET_REDIS` | Separate Redis URL for Socket.IO adapter (if different from `REDIS_URL`) | No | Uses `REDIS_URL` |

### White-Label / Custom Domains

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `WHITE_LABEL_ASSETS_DIR` | Persistent storage path for uploaded logos and favicons | No | `assets/white-label` |
| `WHITE_LABEL_CNAME_TARGET` | CNAME target customers must point custom domains to | No | `APP_URL` hostname |
| `WHITE_LABEL_ENFORCE_CUSTOM_DOMAINS` | Return 403 for unknown custom domains on hosted deployments | No | `true` in hosted production |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for Custom Hostnames | Pro custom domains | — |
| `CLOUDFLARE_ZONE_ID` | Cloudflare zone ID for Custom Hostnames | Pro custom domains | — |

### Database

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `MONGO_URI` | MongoDB connection string | No | `mongodb://mongo:27017/streamient` |
| `REDIS_URL` | Redis connection string | No | `redis://redis:6379` |
| `REDIS_SENTINEL` | Redis Sentinel config as JSON. Example: `[{"host":"sentinel1","port":26379}]` | No | — |

When `REDIS_SENTINEL` is set, the app connects via Sentinel for automatic failover. The JSON array should contain objects with `host` and `port` for each Sentinel node.

### Search (Typesense)

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `TYPESENSE_HOST` | Typesense server host | No | `typesense` |
| `TYPESENSE_PORT` | Typesense server port | No | `8108` |
| `TYPESENSE_PROTOCOL` | Protocol (`http` or `https`) | No | `http` |
| `TYPESENSE_API_KEY` | Typesense API key | Yes | — |
| `TYPESENSE_NODES` | Multi-node cluster config as JSON. Example: `[{"host":"ts1","port":8108,"protocol":"http"},{"host":"ts2","port":8108,"protocol":"http"}]` | No | — |

When `TYPESENSE_NODES` is set, the individual host/port/protocol variables are ignored and the cluster config is used instead.

### AI / LLM

Streamient uses three separate model tiers for different tasks:

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `CHAT_AI_MODEL` | Model for analysis, stats, and general chat responses | No | `gemini-2.0-flash` |
| `CHAT_AI_MODEL_PROVIDER` | Provider: `google` or `openai` | No | `google` |
| `NL_SEARCH_MODEL` | Lightweight model for intent classification | No | `gemini-2.0-flash-lite` |
| `NL_SEARCH_MODEL_PROVIDER` | Provider for intent classification model | No | `google` |
| `TS_CONVERSATION_MODEL` | Model for Typesense conversation search | No | `gemini-2.0-flash-lite` |
| `TS_CONVERSATION_MODEL_PROVIDER` | Provider for conversation model | No | `google` |
| `GOOGLE_API_KEY` | Google AI API key (required when using Google models) | Conditional | — |
| `OPENAI_API_KEY` | OpenAI API key (required when using OpenAI models) | Conditional | — |

At least one API key is required for AI chat to function.

### Email (SMTP)

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `SMTP_HOST` | SMTP server host | Yes | — |
| `SMTP_PORT` | SMTP server port | No | `587` |
| `SMTP_USER` | SMTP username | Yes | — |
| `SMTP_PASS` | SMTP password | Yes | — |
| `SMTP_FROM` | Sender email address | Yes | — |
| `SMTP_SERVERS` | JSON array of SMTP servers for round-robin sending. Overrides `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` when set. | No | — |

`SMTP_SERVERS` example:

```json
[
	{ "name": "smtp-1", "host": "smtp1.example.com", "port": 587, "user": "user1", "pass": "pass1", "from": "noreply@example.com" },
	{ "name": "smtp-2", "host": "smtp2.example.com", "port": 587, "user": "user2", "pass": "pass2", "from": "noreply@example.com" }
]
```

### Email Forwarding

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `EMAIL_FORWARD_DOMAIN` | Domain accepted by `POST /import/email` for project email forwarding, for example `email.streamient.com` | Yes, for forwarding | — |

### Admin

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `SYSADMIN_EMAIL` | System admin email. If set, a sysadmin account is provisioned on startup | No | — |
| `SYSADMIN_PASSWORD` | System admin password | No | — |

### Analytics (OpenPanel)

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `ENABLE_OPENPANEL` | Enable OpenPanel analytics | No | `false` |
| `OPENPANEL_CLIENT_ID` | OpenPanel client ID | No | — |
| `OPENPANEL_CLIENT_SECRET` | OpenPanel client secret | No | — |
| `OPENPANEL_API_URL` | OpenPanel API URL | No | — |

## Reverse Proxy

When running behind a reverse proxy (nginx, Caddy, etc.):

1. Set `APP_URL` to your public domain
2. Proxy WebSocket connections to port 3001
3. Proxy MCP connections to port 3002
4. Set `X-Forwarded-For` and `X-Forwarded-Proto` headers

Example nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name your-instance.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /mcp {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
