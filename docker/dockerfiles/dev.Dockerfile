# syntax=docker/dockerfile:1

FROM node:lts-trixie-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"
WORKDIR /opt/streamient

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl iputils-ping dnsutils git tini vim procps \
    ca-certificates && \
    npm i -g pnpm@latest && \
    npm remove -g yarn && \
    rm -rf /var/lib/apt/lists/*

# Install Chromium + Playwright runtime deps for Crawlee/PlaywrightCrawler.
# In dev image we install via npx because node_modules are mounted/installed later by init service.
RUN mkdir -p /ms-playwright && chmod 755 /ms-playwright
RUN npx -y playwright@1.61.0 install --with-deps chromium

ENTRYPOINT ["tini", "--"]
