FROM node:24-bookworm-slim AS builder
WORKDIR /srv
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/hospital-api/package.json ./package.json
RUN npm install --no-audit --no-fund
COPY apps/hospital-api/ ./
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /srv
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
COPY --from=builder /srv/.next/standalone ./
COPY --from=builder /srv/.next/static ./.next/static
EXPOSE 8080
CMD ["node","server.js"]
