# 🔗 LinkedIn Fetcher

<div align="center">

Um sistema avançado de autenticação e scraping do LinkedIn, construído com Node.js e TypeScript, com suporte a cache Redis e validação de tokens.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/Redis-6.0-red.svg)](https://redis.io/)
[![Axios](https://img.shields.io/badge/Axios-Latest-purple.svg)](https://axios-http.com/)
[![LinkedIn API](https://img.shields.io/badge/LinkedIn_API-Latest-0077B5.svg)](https://developer.linkedin.com/)
[![CI](https://github.com/rafaumeu/linkedin-fetcher/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaumeu/linkedin-fetcher/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/rafaumeu/linkedin-fetcher/branch/main/graph/badge.svg)](https://codecov.io/gh/rafaumeu/linkedin-fetcher)

---

## 📖 Índice

| [Funcionalidades](#-funcionalidades) | [Stack Tecnológica](#-stack-tecnológica) | [Ferramentas de Desenvolvimento](#-ferramentas-de-desenvolvimento) |
|-------------------------------------|------------------------------------------|------------------------------------------------------------------|
| [Pré-requisitos](#-pré-requisitos) | [Configuração](#️-configuração) | [Variáveis de Ambiente](#-variáveis-de-ambiente) |
| [Estrutura do Projeto](#️-estrutura-do-projeto) | [Docker](#-docker) | [Contribuindo](#-contribuindo) |

---
</div>

## 🚀 Funcionalidades

### Autenticação LinkedIn

- **Sistema de Autenticação**:
  - Integração OAuth 2.0 com LinkedIn
  - Gerenciamento seguro de tokens
  - Validação automática de tokens
  - Refresh token automático
  - Suporte a múltiplos escopos

### Sistema de Scraping

- **Extração de Dados**:
  - Perfil completo do usuário
  - Experiências profissionais
  - Certificações
  - Educação
  - Habilidades
  - Validação de dados em tempo real

### Cache e Performance

- **Sistema de Cache**:
  - Integração com Redis
  - Cache de perfis
  - Controle de última atualização
  - Limpeza automática de cache
  - Performance otimizada

## ⚡ Stack Tecnológica

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)
![LinkedIn](https://img.shields.io/badge/LinkedIn_API-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)

## 🔄 Pipeline CI/CD

### Continuous Integration

Nossa pipeline CI executa automaticamente em cada push e pull request:

- **Verificações de Qualidade**:
  - Verificação de tipos TypeScript
  - ESLint para estilo de código
  - Validação de formatação
  - Testes automatizados

- **Estratégia de Testes**:
  - Testes unitários com Vitest
  - Testes em múltiplas versões do Node
  - Execução automática em PRs

### Workflows Automatizados

- **Automação do Project Board**:
  - Rastreamento automático de issues/PRs
  - Atualizações de status
  - Integração com GitHub Projects

- **Gerenciamento de PRs**:
  - Rotulagem automática
  - Code review obrigatório
  - Regras de proteção de branch

## 📦 Pré-requisitos

- Node.js 20+ (versão LTS)
- Yarn
- Redis 6+
- Credenciais do LinkedIn Developer
- Docker e Docker Compose (opcional)

## 🛠️ Configuração

1. Clone o repositório:
```bash
git clone https://github.com/yourusername/linkedin-fetcher.git
cd linkedin-fetcher
```

2. Instale as dependências:
```bash
yarn install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Configure as credenciais do LinkedIn:
   - Crie um aplicativo no LinkedIn Developer Portal
   - Configure as URIs de redirecionamento
   - Adicione as credenciais ao arquivo .env

5. Inicie o ambiente de desenvolvimento:
```bash
docker-compose up -d  # Inicia o Redis
yarn dev  # Inicia o servidor
```

## 🔧 Variáveis de Ambiente

```env
# LinkedIn OAuth
LINKEDIN_CLIENT_ID="seu-client-id"
LINKEDIN_CLIENT_SECRET="seu-client-secret"
LINKEDIN_REDIRECT_URI="http://localhost:3000/api/linkedin/callback"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Cors
CORS_ORIGIN="*"
```

## 🏗️ Estrutura do Projeto

```bash
linkedin-fetcher/
├── src/
│   ├── services/
│   │   ├── LinkedInAuthService.ts
│   │   ├── LinkedInScrapper.ts
│   │   └── CacheService.ts
│   ├── server.ts
│   └── env.ts
├── .github/
│   ├── workflows/
│   └── projects/
└── docker-compose.yml
```

## 🛡️ Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuindo

1. Faça um Fork do projeto
2. Crie sua Feature Branch (`git checkout -b feature/RecursoIncrivel`)
3. Commit suas mudanças (`git commit -m 'feat: Adiciona algum recurso incrível'`)
4. Push para a Branch (`git push origin feature/RecursoIncrivel`)
5. Abra um Pull Request

---

<div align="center">
Feito com ❤️ por Rafael Dias Zendron

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rafael-dias-zendron-528290132/)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/rafaumeu)
</div>