FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs npm black clang-format ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN dotnet tool install -g csharpier --version 0.29.2

ENV PATH="/root/.dotnet/tools:${PATH}"
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

CMD ["npm", "start"]
