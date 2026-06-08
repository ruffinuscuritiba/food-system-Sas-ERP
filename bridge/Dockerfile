FROM node:22-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

COPY package.json .

RUN npm install --omit=dev

COPY bridge.mjs .
COPY auth_kely/ ./auth_kely/

EXPOSE 8080

CMD ["node", "bridge.mjs"]