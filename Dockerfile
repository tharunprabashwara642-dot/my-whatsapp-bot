FROM oven/bun:1 AS app
WORKDIR /app

USER root
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /app/auth \
  && chown -R bun:bun /app
USER bun

COPY --chown=bun:bun package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --chown=bun:bun . .

ENV NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/auth", "/app/data"]
CMD ["bun", "run", "src/index.ts"]
