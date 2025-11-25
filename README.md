# Fitbit API Integration - NestJS

API backend desenvolvida com NestJS para integração com a API do Fitbit, permitindo autenticação OAuth2 e coleta de dados de múltiplos dispositivos Fitbit.

## 📋 Sobre o Projeto

Esta aplicação permite conectar múltiplas contas Fitbit, autenticar usuários via OAuth2 e buscar dados de atividades físicas, sono e outros métricas de saúde. Ideal para projetos que necessitam integrar dados de wearables para análise, dashboards ou pesquisas.

## 🚀 Funcionalidades

- ✅ Autenticação OAuth2 com Fitbit
- ✅ Suporte a múltiplas contas/dispositivos
- ✅ Busca de dados de atividades diárias
- ✅ Busca de dados de sono
- ✅ Time Series (dados agregados por período)
- ✅ Intraday (dados minuto a minuto)*
- ✅ Renovação automática de tokens

**Nota*: Dados intraday requerem aplicação tipo "Personal" ou aprovação especial do Fitbit.

## 🛠️ Tecnologias

- [NestJS](https://nestjs.com/) - Framework Node.js
- [TypeScript](https://www.typescriptlang.org/) - Linguagem
- [Axios](https://axios-http.com/) - Cliente HTTP
- [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/) - API de integração

## 📦 Instalação

### Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn
- Conta de desenvolvedor no Fitbit

### Passo 1: Clone o repositório

git clone <seu-repositorio>
cd fitbit-api-nestjs

text

### Passo 2: Instale as dependências

npm install

text

### Passo 3: Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

FITBIT_CLIENT_ID=seu_client_id_aqui
FITBIT_CLIENT_SECRET=seu_client_secret_aqui
PORT=3003

text

### Passo 4: Registre sua aplicação no Fitbit

1. Acesse [Fitbit Developer](https://dev.fitbit.com/apps)
2. Clique em "Register a new app"
3. Preencha o formulário:
   - **OAuth 2.0 Application Type**: `Server`
   - **Redirect URL**: `http://localhost:3003/fitbit/callback`
   - **Default Access Type**: `Read Only`
4. Copie o **Client ID** e **Client Secret** para o arquivo `.env`

## 🎯 Como Usar

### Iniciar o servidor

Desenvolvimento
npm run start:dev

Produção
npm run build
npm run start:prod

text

O servidor estará rodando em `http://localhost:3003`

### Autenticação

#### 1. Iniciar fluxo OAuth2

Acesse no navegador:
http://localhost:3003/fitbit/auth

text

Você será redirecionado para a página de login do Fitbit. Faça login e autorize a aplicação.

#### 2. Receber tokens

Após autorizar, você receberá uma resposta JSON com:
{
"message": "Autenticação bem-sucedida!",
"accessToken": "eyJhbGci...",
"refreshToken": "a1b2c3d4...",
"userId": "ABC123",
"expiresIn": 28800
}

text

**Importante**: Guarde o `accessToken` e `refreshToken` para fazer as próximas requisições.

## 📚 Endpoints

### 🔐 Autenticação

#### GET `/fitbit/auth`
Inicia o fluxo de autenticação OAuth2

#### GET `/fitbit/callback`
Endpoint de callback do OAuth2 (não chamar manualmente)

#### GET `/fitbit/refresh`
Renova o access token expirado

**Query Params:**
- `refreshToken` (obrigatório)

**Exemplo:**
GET /fitbit/refresh?refreshToken=seu_refresh_token

text

### 📊 Dados de Atividade

#### GET `/fitbit/activity`
Busca resumo de atividades de um dia específico

**Query Params:**
- `accessToken` (obrigatório)
- `date` (opcional, formato: YYYY-MM-DD, padrão: hoje)

**Exemplo:**
GET /fitbit/activity?accessToken=SEU_TOKEN&date=2024-11-24

text

#### GET `/fitbit/time-series`
Busca dados agregados em um intervalo de datas

**Query Params:**
- `accessToken` (obrigatório)
- `resource` (obrigatório): `steps`, `calories`, `distance`, `floors`, `elevation`, `minutesSedentary`, `minutesLightlyActive`, `minutesFairlyActive`, `minutesVeryActive`, `activityCalories`
- `startDate` (obrigatório, formato: YYYY-MM-DD)
- `endDate` (obrigatório, formato: YYYY-MM-DD)

**Exemplo:**
GET /fitbit/time-series?accessToken=SEU_TOKEN&resource=steps&startDate=2024-11-01&endDate=2024-11-24

text

**Resposta:**
{
"activities-steps": [
{
"dateTime": "2024-11-01",
"value": "8234"
},
{
"dateTime": "2024-11-02",
"value": "10521"
}
]
}

text

#### GET `/fitbit/intraday`
Busca dados minuto a minuto (máximo 24h, requer permissão especial)

**Query Params:**
- `accessToken` (obrigatório)
- `resource` (obrigatório): `steps`, `calories`, `distance`, `floors`, `elevation`
- `startDate` (obrigatório, formato: YYYY-MM-DD)
- `endDate` (obrigatório, formato: YYYY-MM-DD)
- `detailLevel` (opcional): `1min` ou `15min` (padrão: `1min`)
- `startTime` (opcional, formato: HH:MM)
- `endTime` (opcional, formato: HH:MM)

**Exemplo:**
GET /fitbit/intraday?accessToken=SEU_TOKEN&resource=steps&startDate=2024-11-24&endDate=2024-11-24&detailLevel=15min&startTime=08:00&endTime=18:00

text

### 😴 Dados de Sono

#### GET `/fitbit/sleep`
Busca dados de sono de um dia específico

**Query Params:**
- `accessToken` (obrigatório)
- `date` (opcional, formato: YYYY-MM-DD, padrão: hoje)

**Exemplo:**
GET /fitbit/sleep?accessToken=SEU_TOKEN&date=2024-11-24

text

## 🔄 Trabalhando com Múltiplas Contas

Para coletar dados de múltiplos dispositivos/usuários:

1. **Autentique cada conta separadamente**:
   - Acesse `/fitbit/auth` para conta 1
   - Faça logout do Fitbit no navegador (ou use aba anônima)
   - Acesse `/fitbit/auth` novamente para conta 2

2. **Armazene os tokens de cada usuário**:
const usuarios = [
{
userId: "ABC123",
accessToken: "token_usuario_1",
refreshToken: "refresh_token_1"
},
{
userId: "XYZ789",
accessToken: "token_usuario_2",
refreshToken: "refresh_token_2"
}
];

text

3. **Faça requisições usando o token correspondente** para cada usuário

## ⚠️ Limitações e Considerações

### Dados Intraday (403 Forbidden)
Aplicações do tipo "Server" **não têm acesso** a dados intraday por padrão. Para obter acesso:
- Solicite permissão especial em https://dev.fitbit.com/build/reference/web-api/intraday/
- Ou use aplicação tipo "Personal" (apenas para seus próprios dados)

### Rate Limits
A API do Fitbit possui limites de requisições:
- **150 requisições por hora** por usuário
- **Intraday**: 1 requisição por segundo

### Expiração de Tokens
- Access tokens expiram em **8 horas**
- Use o endpoint `/fitbit/refresh` para renovar tokens expirados

Desenvolvido usando NestJS