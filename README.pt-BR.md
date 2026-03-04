[English](README.md) | Português

# Fitbit API Integration - NestJS

> **Aviso: Este projeto é uma Prova de Conceito (POC).** Não é production-ready. Foi construído para demonstrar a viabilidade de integrar a Fitbit Web API com um backend NestJS para monitoramento remoto de saúde de pacientes. Os seguintes trade-offs foram feitos intencionalmente para manter o foco na integração principal:
>
> - **Sem autenticação/autorização na API** — os endpoints não são protegidos. A POC foca em demonstrar a integração OAuth2 com o Fitbit, coleta de dados e o fluxo médico-paciente, não em construir um sistema completo de auth. Em produção, seria necessário autenticação JWT com guards por role (DOCTOR/PATIENT).
> - **Tokens Fitbit armazenados como texto plano** no banco (deveriam ser criptografados).
> - **`synchronize: true`** no TypeORM — sincroniza schema automaticamente. Em produção, usar migrations.
> - **Sem rate limiting** — o Fitbit impõe 150 req/hora por usuário; esta API não faz throttle nem cache.

API backend desenvolvida com NestJS para integração com a API do Fitbit. POC que permite médicos monitorarem dados de saúde de seus pacientes através de relógios Fitbit (Flex 2 e Inspire HR).

## Sobre o Projeto

Sistema com cadastro de médicos e pacientes, autenticação OAuth2 com Fitbit, coleta automática de dados de saúde e interface web para visualização. O médico visualiza dados de todos os seus pacientes vinculados em um único painel.

## Funcionalidades

- Autenticação OAuth2 com Fitbit (Authorization Code Grant)
- CRUD de usuários (médicos e pacientes)
- Vinculação médico -> pacientes
- Persistência de tokens Fitbit no banco (PostgreSQL)
- Auto-refresh de tokens (buffer de 15 min antes da expiração)
- Cron job a cada 10 min para verificar sync dos dispositivos
- Histórico de sincronizações por dispositivo (entidade `SyncHistory` — armazena `deviceId`, `batteryLevel` %, modelo, tipo e timestamp de sync)
- Gráfico temporal de bateria (Chart.js) com filtro por dispositivo, intervalo de datas e seleção individual de entradas
- Dados de atividade, sono, frequência cardíaca, perfil e dispositivos
- Time series e intraday (minuto a minuto)*
- Subscriptions (webhooks) e SSE para dados em tempo real
- Interface web para gerenciamento e visualização

\* Dados intraday requerem aplicação tipo "Personal" ou aprovação especial do Fitbit.

## Stack

- **Framework**: [NestJS](https://nestjs.com/) 11.x
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/) 5.x
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) 16 via [TypeORM](https://typeorm.io/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Scheduler**: [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) (cron jobs)
- **Events**: [@nestjs/event-emitter](https://docs.nestjs.com/techniques/events) (webhooks)
- **API**: [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)

## Instalação

### Pré-requisitos

- Node.js (versão 16 ou superior)
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

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
FITBIT_CLIENT_ID=seu_client_id
FITBIT_CLIENT_SECRET=seu_client_secret
FITBIT_REDIRECT_URI=http://localhost:3003/fitbit/callback
PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=fitbit_db
```

### 4. Registre sua aplicação no Fitbit

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

# Produção
npm run build && npm run start:prod
```

O servidor estará rodando em `http://localhost:3003`

## Interface Web

A aplicação inclui uma interface web acessível em `http://localhost:3003`. Páginas disponíveis:

| Página | Descrição |
|--------|-----------|
| **Dashboard** | Visão geral com contadores (total de usuários, médicos, pacientes, conectados ao Fitbit) |
| **Usuários** | CRUD completo - cadastrar, editar e remover médicos e pacientes. Vincular paciente a médico. Botão para conectar/desconectar Fitbit |
| **Dados Resumidos** | Selecionar um médico e visualizar dados de todos os pacientes por abas: Atividade, Sono, Semana, Perfil e **Dispositivos**. A aba Dispositivos exibe dados ao vivo do dispositivo e histórico de sync com gráfico de bateria % por paciente |
| **Dados Completos** | Selecionar um médico e visualizar todos os dados consolidados de cada paciente (atividade + sono + FC + perfil + dispositivos + histórico de sync com gráfico de bateria %) |

Além disso, a página `/fitbit/connect` fornece a interface para o fluxo OAuth2 de vinculação do Fitbit a um usuário.

## Endpoints

### Autenticação Fitbit

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/fitbit/auth?userId=:id` | Inicia fluxo OAuth2 (redireciona para Fitbit) |
| GET | `/fitbit/callback` | Callback do OAuth2 (chamado pelo Fitbit) |
| POST | `/fitbit/refresh` | Renova access token (body: `{ "refreshToken": "..." }`) |
| GET | `/fitbit/connect` | Página web para conectar Fitbit |

### CRUD de Usuários

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/users` | Criar usuário (médico ou paciente) |
| GET | `/users` | Listar todos os usuários |
| GET | `/users/doctors` | Listar médicos |
| GET | `/users/patients` | Listar pacientes |
| GET | `/users/:id` | Buscar usuário por ID |
| PUT | `/users/:id` | Atualizar usuário |
| DELETE | `/users/:id` | Remover usuário |

### Dados Fitbit por Usuário

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users/:id/fitbit/activity?date=YYYY-MM-DD` | Atividade diária |
| GET | `/users/:id/fitbit/sleep?date=YYYY-MM-DD` | Dados de sono |
| GET | `/users/:id/fitbit/week?weekStart=YYYY-MM-DD` | Dados de 7 dias (atividade + sono) |
| GET | `/users/:id/fitbit/heart-rate?date=YYYY-MM-DD` | Frequência cardíaca intraday |
| GET | `/users/:id/fitbit/time-series?resource=steps&startDate=...&endDate=...` | Time series por período |
| GET | `/users/:id/fitbit/intraday?resource=steps&startDate=...&endDate=...` | Intraday minuto a minuto |
| GET | `/users/:id/fitbit/profile` | Perfil Fitbit (nome, idade, altura, peso) |
| GET | `/users/:id/fitbit/devices` | Dispositivos e último sync |
| GET | `/users/:id/fitbit/sync-history?limit=20` | Histórico de sincronizações (inclui `batteryLevel` % e `deviceId` por registro) |
| GET | `/users/:id/fitbit/all?date=YYYY-MM-DD` | Todos os dados do dia (atividade + sono + FC) |
| POST | `/users/:id/fitbit` | Vincular tokens Fitbit ao usuário |
| DELETE | `/users/:id/fitbit` | Desconectar Fitbit do usuário |

### Visão do Médico (dados dos pacientes)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users/:id/patients` | Listar pacientes do médico |
| GET | `/users/:id/patients/fitbit/activity?date=...` | Atividade de todos os pacientes |
| GET | `/users/:id/patients/fitbit/sleep?date=...` | Sono de todos os pacientes |
| GET | `/users/:id/patients/fitbit/week?weekStart=...` | Dados semanais de todos os pacientes |
| GET | `/users/:id/patients/fitbit/profile` | Perfil Fitbit de todos os pacientes |
| GET | `/users/:id/patients/fitbit/all?date=...` | Todos os dados de todos os pacientes |

### Endpoints diretos (acesso com Fitbit token via header)

Estes endpoints aceitam um Fitbit access token diretamente via header `Authorization: Bearer <fitbit_token>`, sem necessidade de um usuário cadastrado no sistema.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/fitbit/activity?date=...` | Atividade |
| GET | `/fitbit/sleep?date=...` | Sono |
| GET | `/fitbit/week?weekStart=...` | Dados semanais |
| GET | `/fitbit/time-series?resource=...&startDate=...&endDate=...` | Time series |
| GET | `/fitbit/intraday?resource=...&startDate=...&endDate=...` | Intraday |
| GET | `/fitbit/heart-rate-intraday?date=...` | FC intraday |
| POST | `/fitbit/refresh` | Renovar token (body: `{ "refreshToken": "..." }`) |

### Sessões e Tempo Real

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/fitbit/session/:sessionId/patient` | Adicionar paciente à sessão |
| DELETE | `/fitbit/session/:sessionId/patient/:patientId` | Remover paciente da sessão |
| SSE | `/fitbit/session/:sessionId/live` | Stream de dados em tempo real |
| DELETE | `/fitbit/session/:sessionId` | Encerrar sessão |
| POST | `/fitbit/webhook` | Receber notificações do Fitbit |

## Cobertura de Dados: Esta API vs Fitbit Web API

Comparação entre todos os tipos de dados disponíveis na [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/) e o que esta API implementa. A coluna **Restrição de Hardware** indica quando um dado **não pode ser coletado** pelos modelos Flex 2 e/ou Inspire HR usados nesta POC.

| Categoria | Dado | Fitbit Web API | Esta API | Restrição de Hardware (Flex 2 / Inspire HR) |
|-----------|------|:--------------:|:--------:|----------------------------------------------|
| **Atividade** | Passos | ✅ | ✅ | Nenhuma |
| | Calorias | ✅ | ✅ | Nenhuma |
| | Distância | ✅ | ✅ | Nenhuma |
| | Andares (floors) | ✅ | ✅ | ⚠️ **Ambos sem altímetro** - retorna 0 |
| | Elevação | ✅ | ✅ | ⚠️ **Ambos sem altímetro** - retorna 0 |
| | Minutos sedentário | ✅ | ✅ | Nenhuma |
| | Minutos levemente ativo | ✅ | ✅ | Nenhuma |
| | Minutos moderadamente ativo | ✅ | ✅ | Nenhuma |
| | Minutos muito ativo | ✅ | ✅ | Nenhuma |
| | Active Zone Minutes (AZM) | ✅ | ❌ | ⚠️ **Flex 2 sem HR** - não coleta |
| | Intraday de atividade | ✅ | ✅ | Nenhuma (requer app Personal) |
| **Sono** | Resumo de sono | ✅ | ✅ | Nenhuma |
| | Estágios (light/deep/REM) | ✅ | ✅ | ⚠️ **Flex 2 sem HR** - retorna apenas sono básico (awake/asleep/restless) |
| | Sleep time series | ✅ | ❌ | Nenhuma |
| **Freq. Cardíaca** | Heart rate diário (zonas) | ✅ | ✅ | ⚠️ **Flex 2 sem HR** - não coleta |
| | Heart rate intraday | ✅ | ✅ | ⚠️ **Flex 2 sem HR** - não coleta |
| | Heart Rate Variability (HRV) | ✅ | ❌ | ⚠️ **Ambos não suportam** HRV |
| **Respiração** | Breathing rate | ✅ | ❌ | ⚠️ **Flex 2 sem HR** - não coleta |
| **Temperatura** | Temperatura da pele | ✅ | ❌ | ⚠️ **Ambos sem sensor de temp.** |
| | Temperatura corporal (manual) | ✅ | ❌ | Nenhuma (entrada manual) |
| **Oxigenação** | SpO2 | ✅ | ❌ | ⚠️ **Ambos sem sensor SpO2** |
| **Cardio Fitness** | VO2 Max | ✅ | ❌ | ⚠️ **Flex 2 sem HR** - não calcula |
| **Corpo** | Peso | ✅ | ❌ | Nenhuma (scope já autorizado) |
| | Gordura corporal | ✅ | ❌ | Nenhuma (requer balança Aria) |
| | IMC | ✅ | ❌ | Nenhuma |
| **Nutrição** | Alimentos registrados | ✅ | ❌ | Nenhuma (entrada manual) |
| | Água | ✅ | ❌ | Nenhuma (entrada manual) |
| **ECG** | Eletrocardiograma | ✅ | ❌ | ⚠️ **Ambos sem sensor ECG** (apenas Sense/Sense 2) |
| **IRN** | Irregular Rhythm Notifications | ✅ | ❌ | ⚠️ **Ambos sem sensor ECG** (apenas Sense/Sense 2) |
| **Perfil** | Dados do usuário | ✅ | ✅ | Nenhuma |
| **Dispositivos** | Lista de devices | ✅ | ✅ | Nenhuma |
| **OAuth** | Autenticação | ✅ | ✅ | Nenhuma |
| | Refresh token | ✅ | ✅ | Nenhuma |
| **Subscriptions** | Webhooks | ✅ | ✅ | Nenhuma |

**Legenda**: ⚠️ = limitação de hardware dos modelos usados nesta POC. O endpoint pode existir na Fitbit Web API, mas o dispositivo não possui o sensor necessário para gerar os dados.

### Cobertura por Modelo: Flex 2 vs Inspire HR

Os modelos **Flex 2** e **Inspire HR** possuem sensores diferentes, o que impacta diretamente quais dados podem ser coletados.

#### Sensores

| Sensor | Flex 2 | Inspire HR |
|--------|:------:|:----------:|
| Acelerômetro 3 eixos | ✅ | ✅ |
| Monitor óptico de freq. cardíaca | ❌ | ✅ |
| Altímetro | ❌ | ❌ |
| GPS (conectado ao celular) | ❌ | ✅ |
| Sensor SpO2 | ❌ | ❌ |
| Sensor de temperatura | ❌ | ❌ |
| Tela OLED | ❌ | ✅ |
| Resistência à água | 10m | 50m |

#### Dados Coletáveis via Esta API

| Dado | Flex 2 | Inspire HR | Endpoint | Motivo da restrição |
|------|:------:|:----------:|----------|---------------------|
| Passos | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Calorias | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Distância | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Andares (floors) | ❌ | ❌ | — | Sem altímetro em ambos |
| Minutos ativos | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Intraday de atividade | ✅ | ✅ | `/users/:id/fitbit/intraday` | |
| Sono (duração total) | ✅ | ✅ | `/users/:id/fitbit/sleep` | |
| Sono (estágios light/deep/REM) | ❌ | ✅ | `/users/:id/fitbit/sleep` | Flex 2 sem sensor HR |
| Freq. cardíaca (24/7) | ❌ | ✅ | `/users/:id/fitbit/heart-rate` | Flex 2 sem sensor HR |
| Freq. cardíaca intraday | ❌ | ✅ | `/users/:id/fitbit/heart-rate` | Flex 2 sem sensor HR |
| Zonas de freq. cardíaca | ❌ | ✅ | `/users/:id/fitbit/activity` | Flex 2 sem sensor HR |
| Active Zone Minutes | ❌ | ⚠️ | — | Não implementado (Inspire HR suporta) |
| VO2 Max | ❌ | ⚠️ | — | Não implementado (Inspire HR suporta) |
| Breathing rate | ❌ | ⚠️ | — | Não implementado (Inspire HR suporta) |
| GPS conectado | ❌ | ✅ | `/users/:id/fitbit/activity` | Flex 2 sem GPS |
| Reconhecimento auto. de exercício | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Perfil do usuário | ✅ | ✅ | `/users/:id/fitbit/profile` | |
| Dispositivos e último sync | ✅ | ✅ | `/users/:id/fitbit/devices` | |
| Histórico de sync | ✅ | ✅ | `/users/:id/fitbit/sync-history` | |
| Dados semanais | ✅ | ✅ | `/users/:id/fitbit/week` | |
| Time series | ✅ | ✅ | `/users/:id/fitbit/time-series` | |
| SpO2 | ❌ | ❌ | — | Sem sensor em ambos |
| Temperatura da pele | ❌ | ❌ | — | Sem sensor em ambos |
| ECG | ❌ | ❌ | — | Sem sensor em ambos |
| HRV | ❌ | ❌ | — | Ambos não suportam |

**Legenda**: ✅ = disponível | ❌ = indisponível (sem hardware) | ⚠️ = hardware suporta, mas endpoint não implementado nesta API

> **Resumo**: O **Inspire HR** fornece dados significativamente mais ricos que o **Flex 2** graças ao sensor de frequência cardíaca, que habilita estágios de sono, zonas de FC, VO2 Max e breathing rate. O **Flex 2** é limitado a dados baseados em acelerômetro (passos, distância, sono básico). Nenhum dos dois modelos possui sensores de SpO2, temperatura, ECG ou altímetro.

## Limitações e Considerações

### Dados Intraday (403 Forbidden)
Aplicações do tipo "Server" **não têm acesso** a dados intraday por padrão. Para obter acesso:
- Solicite permissão especial em https://dev.fitbit.com/build/reference/web-api/intraday/
- Ou use aplicação tipo "Personal" (apenas para seus próprios dados)

### Rate Limits
- **150 requisições por hora** por usuário
- **Intraday**: 1 requisição por segundo

### Expiração de Tokens
- **Access Token**: expira em **8 horas**
- **Refresh Token**: **não expira** por tempo — permanece válido indefinidamente até ser usado. Cada refresh token é de **uso único**: ao ser utilizado, um novo access token **e** um novo refresh token são retornados. O refresh token antigo é invalidado imediatamente
- Refresh tokens podem ser revogados se o usuário revogar acesso no Fitbit ou trocar a senha
- O cron job (a cada 10 min) e as requisições sob demanda renovam tokens automaticamente faltando **15 minutos** para a expiração

### Limitações de Hardware (Flex 2 e Inspire HR)
- **Andares/elevação**: Ambos sem altímetro, endpoint retorna 0
- **Frequência cardíaca**: Flex 2 não possui sensor óptico de HR
- **Estágios de sono**: Flex 2 retorna apenas sono básico (awake/asleep/restless)
- **SpO2, temperatura, ECG, HRV**: Nenhum dos dois modelos possui esses sensores
