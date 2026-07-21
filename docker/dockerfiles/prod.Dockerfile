# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────
# Stage 1: Base image with system tools & pnpm
# ──────────────────────────────────────────────
FROM node:lts-trixie-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /opt/streamient

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl iputils-ping dnsutils git tini vim procps \
    ca-certificates && \
    npm i -g pnpm@latest && \
    npm remove -g yarn && \
    rm -rf /var/lib/apt/lists/*

# ──────────────────────────────────────────────
# Stage 2: Install ALL deps (dev included for esbuild)
# ──────────────────────────────────────────────
FROM builder AS deps

COPY --link .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --link apps/mcp/package.json ./apps/mcp/
COPY --link docs/package.json ./docs/
RUN pnpm install --no-frozen-lockfile

# ──────────────────────────────────────────────
# Stage 3: Build frontend assets + VitePress docs
# ──────────────────────────────────────────────
FROM deps AS build

ARG APP_VERSION=latest
ENV VITEPRESS_VERSION=$APP_VERSION
# Base for the vanity-domain docs build (docs.streamient.com) — root so URLs are clean.
ARG STREAMIENT_DOCS_VANITY_BASE=/

COPY --link . .
RUN NODE_ENV=production node build.js
# Build the docs twice from one source: the prefixed build (/docs/) served at
# app.streamient.com/docs/, and a root build (/) served at docs.streamient.com.
# VitePress always writes to .vitepress/dist, so move the first aside.
RUN node docs/scripts/export-openapi.js \
    && pnpm --filter @streamient/docs exec vitepress build \
    && mv docs/.vitepress/dist docs/.vitepress/dist-prefixed \
    && STREAMIENT_DOCS_BASE="${STREAMIENT_DOCS_VANITY_BASE}" pnpm --filter @streamient/docs exec vitepress build \
    && mv docs/.vitepress/dist docs/.vitepress/dist-root \
    && mv docs/.vitepress/dist-prefixed docs/.vitepress/dist

# ──────────────────────────────────────────────
# Stage 4: Production image (prod deps only)
# ──────────────────────────────────────────────
FROM builder AS production

COPY --link .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --link apps/mcp/package.json ./apps/mcp/
COPY --link docs/package.json ./docs/
RUN pnpm install --prod --no-frozen-lockfile

COPY --link . .

# Overwrite with built assets from stage 3
COPY --link --from=build /opt/streamient/public/js/vendor.js ./public/js/vendor.js
COPY --link --from=build /opt/streamient/public/js/editor.js ./public/js/editor.js
COPY --link --from=build /opt/streamient/public/js/graph_bundle.js ./public/js/graph_bundle.js
COPY --link --from=build /opt/streamient/public/js/iframe_resizer_parent.js ./public/js/iframe_resizer_parent.js
COPY --link --from=build /opt/streamient/public/js/iframe_resizer_child.js ./public/js/iframe_resizer_child.js
COPY --link --from=build /opt/streamient/public/js/email_dark_mode_child.js ./public/js/email_dark_mode_child.js
COPY --link --from=build /opt/streamient/public/js/email_quote_collapse_child.js ./public/js/email_quote_collapse_child.js
COPY --link --from=build /opt/streamient/public/js/email_iframe_renderer.js ./public/js/email_iframe_renderer.js
COPY --link --from=build /opt/streamient/public/css/admin_vendor.css ./public/css/admin_vendor.css
COPY --link --from=build /opt/streamient/public/css/*.woff2 ./public/css/
COPY --link --from=build /opt/streamient/public/css/*.woff ./public/css/
COPY --link --from=build /opt/streamient/public/css/*.ttf ./public/css/
COPY --link --from=build /opt/streamient/public/build-id ./public/build-id
COPY --link --from=build /opt/streamient/docs/.vitepress/dist ./docs-dist
COPY --link --from=build /opt/streamient/docs/.vitepress/dist-root ./docs-dist-root

USER node
EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["npm", "start"]
