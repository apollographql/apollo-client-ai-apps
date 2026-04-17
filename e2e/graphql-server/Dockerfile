FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.ts ./

EXPOSE 4000

CMD ["node_modules/.bin/tsx", "server.ts"]
