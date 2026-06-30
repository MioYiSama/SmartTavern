FROM node:26-bookworm-slim AS build

RUN DEBIAN_FRONTEND=noninteractive \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates
RUN npm install -g corepack@latest && corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM gcr.io/distroless/nodejs26-debian13

WORKDIR /app
COPY --from=build /app/.output .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000
CMD ["./server/index.mjs"]
