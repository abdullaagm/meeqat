FROM node:20-alpine
WORKDIR /app
COPY server.js package.json ./
COPY public ./public
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data CLOUD=1
RUN mkdir -p /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1
CMD ["node", "server.js"]
