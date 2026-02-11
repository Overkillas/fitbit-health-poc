# Fitbit API Integration - NestJS

API backend desenvolvida com NestJS para integracao com a API do Fitbit. POC que permite medicos monitorarem dados de saude de seus pacientes atraves de relogios Fitbit (Flex 2 e Inspire HR).

## Sobre o Projeto

Sistema com cadastro de medicos e pacientes, autenticacao OAuth2 com Fitbit, coleta automatica de dados de saude e interface web para visualizacao. O medico visualiza dados de todos os seus pacientes vinculados em um unico painel.

## Funcionalidades

- Autenticacao OAuth2 com Fitbit (Authorization Code Grant)
- CRUD de usuarios (medicos e pacientes)
- Vinculacao medico -> pacientes
- Persistencia de tokens Fitbit no banco (PostgreSQL)
- Auto-refresh de tokens (buffer de 5 min antes da expiracao)
- Cron job a cada 10 min para verificar sync dos dispositivos
- Historico de sincronizacoes (SyncHistory)
- Dados de atividade, sono, frequencia cardiaca, perfil e dispositivos
- Time series e intraday (minuto a minuto)*
- Subscriptions (webhooks) e SSE para dados em tempo real
- Interface web para gerenciamento e visualizacao

\* Dados intraday requerem aplicacao tipo "Personal" ou aprovacao especial do Fitbit.

## Stack

- **Framework**: [NestJS](https://nestjs.com/) 11.x
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/) 5.x
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) 16 via [TypeORM](https://typeorm.io/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Scheduler**: [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) (cron jobs)
- **Events**: [@nestjs/event-emitter](https://docs.nestjs.com/techniques/events) (webhooks)
- **API**: [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)

## Instalacao

### Pre-requisitos

- Node.js (versao 16 ou superior)
- PostgreSQL (ou Docker)
- Conta de desenvolvedor no [Fitbit](https://dev.fitbit.com/apps)

### 1. Clone e instale

```bash
git clone <seu-repositorio>
cd fitbit-api
npm install
```

### 2. Suba o banco de dados

```bash
docker compose up -d
```

### 3. Configure as variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
FITBIT_CLIENT_ID=seu_client_id
FITBIT_CLIENT_SECRET=seu_client_secret
PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=fitbit_db
```

### 4. Registre sua aplicacao no Fitbit

1. Acesse [Fitbit Developer](https://dev.fitbit.com/apps)
2. Clique em "Register a new app"
3. Preencha:
   - **OAuth 2.0 Application Type**: `Server`
   - **Redirect URL**: `http://localhost:3003/fitbit/callback`
   - **Default Access Type**: `Read Only`
4. Copie o **Client ID** e **Client Secret** para o `.env`

### 5. Inicie o servidor

```bash
# Desenvolvimento
npm run start:dev

# Producao
npm run build && npm run start:prod
```

O servidor estara rodando em `http://localhost:3003`

## Interface Web

A aplicacao inclui uma interface web acessivel em `http://localhost:3003`. Paginas disponiveis:

| Pagina | Descricao |
|--------|-----------|
| **Dashboard** | Visao geral com contadores (total de usuarios, medicos, pacientes, conectados ao Fitbit) |
| **Usuarios** | CRUD completo - cadastrar, editar e remover medicos e pacientes. Vincular paciente a medico. Botao para conectar/desconectar Fitbit |
| **Dados Resumidos** | Selecionar um medico e visualizar dados de todos os pacientes por abas: Atividade, Sono, Semana e Perfil. Inclui badge de ultimo sync por paciente |
| **Dados Completos** | Selecionar um medico e visualizar todos os dados consolidados de cada paciente (atividade + sono + FC + perfil + dispositivos + historico de sync) |

Alem disso, a pagina `/fitbit/connect` fornece a interface para o fluxo OAuth2 de vinculacao do Fitbit a um usuario.

## Endpoints

### Autenticacao Fitbit

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/fitbit/auth?userId=:id` | Inicia fluxo OAuth2 (redireciona para Fitbit) |
| GET | `/fitbit/callback` | Callback do OAuth2 (chamado pelo Fitbit) |
| GET | `/fitbit/refresh?refreshToken=:token` | Renova access token manualmente |
| GET | `/fitbit/connect` | Pagina web para conectar Fitbit |

### CRUD de Usuarios

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/users` | Criar usuario (medico ou paciente) |
| GET | `/users` | Listar todos os usuarios |
| GET | `/users/doctors` | Listar medicos |
| GET | `/users/patients` | Listar pacientes |
| GET | `/users/:id` | Buscar usuario por ID |
| PUT | `/users/:id` | Atualizar usuario |
| DELETE | `/users/:id` | Remover usuario |

### Dados Fitbit por Usuario

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/users/:id/fitbit/activity?date=YYYY-MM-DD` | Atividade diaria |
| GET | `/users/:id/fitbit/sleep?date=YYYY-MM-DD` | Dados de sono |
| GET | `/users/:id/fitbit/week?weekStart=YYYY-MM-DD` | Dados de 7 dias (atividade + sono) |
| GET | `/users/:id/fitbit/heart-rate?date=YYYY-MM-DD` | Frequencia cardiaca intraday |
| GET | `/users/:id/fitbit/time-series?resource=steps&startDate=...&endDate=...` | Time series por periodo |
| GET | `/users/:id/fitbit/intraday?resource=steps&startDate=...&endDate=...` | Intraday minuto a minuto |
| GET | `/users/:id/fitbit/profile` | Perfil Fitbit (nome, idade, altura, peso) |
| GET | `/users/:id/fitbit/devices` | Dispositivos e ultimo sync |
| GET | `/users/:id/fitbit/sync-history?limit=20` | Historico de sincronizacoes |
| GET | `/users/:id/fitbit/all?date=YYYY-MM-DD` | Todos os dados do dia (atividade + sono + FC) |
| POST | `/users/:id/fitbit` | Vincular tokens Fitbit ao usuario |
| DELETE | `/users/:id/fitbit` | Desconectar Fitbit do usuario |

### Visao do Medico (dados dos pacientes)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/users/:id/patients` | Listar pacientes do medico |
| GET | `/users/:id/patients/fitbit/activity?date=...` | Atividade de todos os pacientes |
| GET | `/users/:id/patients/fitbit/sleep?date=...` | Sono de todos os pacientes |
| GET | `/users/:id/patients/fitbit/week?weekStart=...` | Dados semanais de todos os pacientes |
| GET | `/users/:id/patients/fitbit/profile` | Perfil Fitbit de todos os pacientes |
| GET | `/users/:id/patients/fitbit/all?date=...` | Todos os dados de todos os pacientes |

### Endpoints Legados (acesso direto com token)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/fitbit/activity?accessToken=...&date=...` | Atividade (token direto) |
| GET | `/fitbit/sleep?accessToken=...&date=...` | Sono (token direto) |
| GET | `/fitbit/week?accessToken=...&weekStart=...` | Dados semanais (token direto) |
| GET | `/fitbit/time-series?accessToken=...&resource=...&startDate=...&endDate=...` | Time series (token direto) |
| GET | `/fitbit/intraday?accessToken=...&resource=...&startDate=...&endDate=...` | Intraday (token direto) |
| GET | `/fitbit/heart-rate-intraday?accessToken=...&date=...` | FC intraday (token direto) |

### Sessoes e Tempo Real

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/fitbit/session/:sessionId/patient` | Adicionar paciente a sessao |
| DELETE | `/fitbit/session/:sessionId/patient/:patientId` | Remover paciente da sessao |
| SSE | `/fitbit/session/:sessionId/live` | Stream de dados em tempo real |
| DELETE | `/fitbit/session/:sessionId` | Encerrar sessao |
| POST | `/fitbit/webhook` | Receber notificacoes do Fitbit |

## Cobertura de Dados: Esta API vs Fitbit Web API

Comparacao entre todos os tipos de dados disponiveis na [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/) e o que esta API implementa. A coluna **Restricao de Hardware** indica quando um dado **nao pode ser coletado** pelos modelos Flex 2 e/ou Inspire HR usados nesta POC.

| Categoria | Dado | Fitbit Web API | Esta API | Restricao de Hardware (Flex 2 / Inspire HR) |
|-----------|------|:--------------:|:--------:|----------------------------------------------|
| **Atividade** | Passos | ✅ | ✅ | Nenhuma |
| | Calorias | ✅ | ✅ | Nenhuma |
| | Distancia | ✅ | ✅ | Nenhuma |
| | Andares (floors) | ✅ | ✅ | ⚠️ **Ambos sem altimetro** - retorna 0 |
| | Elevacao | ✅ | ✅ | ⚠️ **Ambos sem altimetro** - retorna 0 |
| | Minutos sedentario | ✅ | ✅ | Nenhuma |
| | Minutos levemente ativo | ✅ | ✅ | Nenhuma |
| | Minutos moderadamente ativo | ✅ | ✅ | Nenhuma |
| | Minutos muito ativo | ✅ | ✅ | Nenhuma |
| | Active Zone Minutes (AZM) | ✅ | ❌ | ⚠️ **Flex 2 sem HR** - nao coleta |
| | Intraday de atividade | ✅ | ✅ | Nenhuma (requer app Personal) |
| **Sono** | Resumo de sono | ✅ | ✅ | Nenhuma |
| | Estagios (light/deep/REM) | ✅ | ✅ | ⚠️ **Flex 2 sem HR** - retorna apenas sono basico (awake/asleep/restless) |
| | Sleep time series | ✅ | ❌ | Nenhuma |
| **Freq. Cardiaca** | Heart rate diario (zonas) | ✅ | ✅ | ⚠️ **Flex 2 sem HR** - nao coleta |
| | Heart rate intraday | ✅ | ✅ | ⚠️ **Flex 2 sem HR** - nao coleta |
| | Heart Rate Variability (HRV) | ✅ | ❌ | ⚠️ **Ambos nao suportam** HRV |
| **Respiracao** | Breathing rate | ✅ | ❌ | ⚠️ **Flex 2 sem HR** - nao coleta |
| **Temperatura** | Temperatura da pele | ✅ | ❌ | ⚠️ **Ambos sem sensor de temp.** |
| | Temperatura corporal (manual) | ✅ | ❌ | Nenhuma (entrada manual) |
| **Oxigenacao** | SpO2 | ✅ | ❌ | ⚠️ **Ambos sem sensor SpO2** |
| **Cardio Fitness** | VO2 Max | ✅ | ❌ | ⚠️ **Flex 2 sem HR** - nao calcula |
| **Corpo** | Peso | ✅ | ❌ | Nenhuma (scope ja autorizado) |
| | Gordura corporal | ✅ | ❌ | Nenhuma (requer balanca Aria) |
| | IMC | ✅ | ❌ | Nenhuma |
| **Nutricao** | Alimentos registrados | ✅ | ❌ | Nenhuma (entrada manual) |
| | Agua | ✅ | ❌ | Nenhuma (entrada manual) |
| **ECG** | Eletrocardiograma | ✅ | ❌ | ⚠️ **Ambos sem sensor ECG** (apenas Sense/Sense 2) |
| **IRN** | Irregular Rhythm Notifications | ✅ | ❌ | ⚠️ **Ambos sem sensor ECG** (apenas Sense/Sense 2) |
| **Perfil** | Dados do usuario | ✅ | ✅ | Nenhuma |
| **Dispositivos** | Lista de devices | ✅ | ✅ | Nenhuma |
| **OAuth** | Autenticacao | ✅ | ✅ | Nenhuma |
| | Refresh token | ✅ | ✅ | Nenhuma |
| **Subscriptions** | Webhooks | ✅ | ✅ | Nenhuma |

**Legenda**: ⚠️ = limitacao de hardware dos modelos usados nesta POC. O endpoint pode existir na Fitbit Web API, mas o dispositivo nao possui o sensor necessario para gerar os dados.

### Cobertura por Modelo: Flex 2 vs Inspire HR

Os modelos **Flex 2** e **Inspire HR** possuem sensores diferentes, o que impacta diretamente quais dados podem ser coletados.

#### Sensores

| Sensor | Flex 2 | Inspire HR |
|--------|:------:|:----------:|
| Acelerometro 3 eixos | ✅ | ✅ |
| Monitor optico de freq. cardiaca | ❌ | ✅ |
| Altimetro | ❌ | ❌ |
| GPS (conectado ao celular) | ❌ | ✅ |
| Sensor SpO2 | ❌ | ❌ |
| Sensor de temperatura | ❌ | ❌ |
| Tela OLED | ❌ | ✅ |
| Resistencia a agua | 10m | 50m |

#### Dados Coletaveis via Esta API

| Dado | Flex 2 | Inspire HR | Endpoint | Motivo da restricao |
|------|:------:|:----------:|----------|---------------------|
| Passos | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Calorias | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Distancia | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Andares (floors) | ❌ | ❌ | — | Sem altimetro em ambos |
| Minutos ativos | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Intraday de atividade | ✅ | ✅ | `/users/:id/fitbit/intraday` | |
| Sono (duracao total) | ✅ | ✅ | `/users/:id/fitbit/sleep` | |
| Sono (estagios light/deep/REM) | ❌ | ✅ | `/users/:id/fitbit/sleep` | Flex 2 sem sensor HR |
| Freq. cardiaca (24/7) | ❌ | ✅ | `/users/:id/fitbit/heart-rate` | Flex 2 sem sensor HR |
| Freq. cardiaca intraday | ❌ | ✅ | `/users/:id/fitbit/heart-rate` | Flex 2 sem sensor HR |
| Zonas de freq. cardiaca | ❌ | ✅ | `/users/:id/fitbit/activity` | Flex 2 sem sensor HR |
| Active Zone Minutes | ❌ | ⚠️ | — | Nao implementado (Inspire HR suporta) |
| VO2 Max | ❌ | ⚠️ | — | Nao implementado (Inspire HR suporta) |
| Breathing rate | ❌ | ⚠️ | — | Nao implementado (Inspire HR suporta) |
| GPS conectado | ❌ | ✅ | `/users/:id/fitbit/activity` | Flex 2 sem GPS |
| Reconhecimento auto. de exercicio | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Perfil do usuario | ✅ | ✅ | `/users/:id/fitbit/profile` | |
| Dispositivos e ultimo sync | ✅ | ✅ | `/users/:id/fitbit/devices` | |
| Historico de sync | ✅ | ✅ | `/users/:id/fitbit/sync-history` | |
| Dados semanais | ✅ | ✅ | `/users/:id/fitbit/week` | |
| Time series | ✅ | ✅ | `/users/:id/fitbit/time-series` | |
| SpO2 | ❌ | ❌ | — | Sem sensor em ambos |
| Temperatura da pele | ❌ | ❌ | — | Sem sensor em ambos |
| ECG | ❌ | ❌ | — | Sem sensor em ambos |
| HRV | ❌ | ❌ | — | Ambos nao suportam |

**Legenda**: ✅ = disponivel | ❌ = indisponivel (sem hardware) | ⚠️ = hardware suporta, mas endpoint nao implementado nesta API

> **Resumo**: O **Inspire HR** fornece dados significativamente mais ricos que o **Flex 2** gracas ao sensor de frequencia cardiaca, que habilita estagios de sono, zonas de FC, VO2 Max e breathing rate. O **Flex 2** e limitado a dados baseados em acelerometro (passos, distancia, sono basico). Nenhum dos dois modelos possui sensores de SpO2, temperatura, ECG ou altimetro.

## Limitacoes e Consideracoes

### Dados Intraday (403 Forbidden)
Aplicacoes do tipo "Server" **nao tem acesso** a dados intraday por padrao. Para obter acesso:
- Solicite permissao especial em https://dev.fitbit.com/build/reference/web-api/intraday/
- Ou use aplicacao tipo "Personal" (apenas para seus proprios dados)

### Rate Limits
- **150 requisicoes por hora** por usuario
- **Intraday**: 1 requisicao por segundo

### Expiracao de Tokens
- Access tokens expiram em **8 horas**
- O cron job renova automaticamente tokens proximos da expiracao
- Refresh tokens podem ser revogados se o usuario revogar acesso no Fitbit ou trocar a senha

### Limitacoes de Hardware (Flex 2 e Inspire HR)
- **Andares/elevacao**: Ambos sem altimetro, endpoint retorna 0
- **Frequencia cardiaca**: Flex 2 nao possui sensor optico de HR
- **Estagios de sono**: Flex 2 retorna apenas sono basico (awake/asleep/restless)
- **SpO2, temperatura, ECG, HRV**: Nenhum dos dois modelos possui esses sensores
