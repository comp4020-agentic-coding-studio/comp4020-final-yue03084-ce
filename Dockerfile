# syntax = docker/dockerfile:1

# One Node process; node runs server.ts directly (type stripping) and keeps its
# SQLite file on the /data volume. No npm dependencies, so nothing to install.
FROM docker.io/library/node:24.21.0-alpine
WORKDIR /app
COPY server.ts README.md ./
COPY public/ public/
ENV DATA_DIR=/data
CMD ["node", "server.ts"]
