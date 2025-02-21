FROM node:23.8.0-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache python3 make g++

# Copiar arquivos de configuração
COPY package*.json tsconfig.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Expor porta
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"] 