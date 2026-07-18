FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . ./
RUN mkdir -p /app/data && chown -R node:node /app

USER node
CMD ["npm", "run", "indexer"]
