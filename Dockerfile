FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY public ./public
COPY src ./src
COPY database ./database
COPY scripts ./scripts
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
