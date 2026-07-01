[English](README.md) | Português

# Fitbit API Integration - NestJS

> **Aviso: Este projeto é uma Prova de Conceito (POC).** Não é production-ready. Foi construído para demonstrar a viabilidade de integrar a Fitbit Web API com um backend NestJS para monitoramento remoto de saúde de pacientes. Os seguintes trade-offs foram feitos intencionalmente para manter o foco na integração principal:
> 
> - **Sem autenticação/autorização na API** — os endpoints não são protegidos. A POC foca em demonstrar a integração OAuth2 com o Fitbit, coleta de dados e o fluxo médico-paciente, não em construir um sistema completo de auth. Em produção, seria necessário autenticação JWT com guards por role (DOCTOR/PATIENT).
> - **Tokens Fitbit armazenados como texto plano** no banco (deveriam ser criptografados).
> - **`synchronize: true`** no TypeORM — sincroniza schema automaticamente. Em produção, usar migrations.
> - **Sem rate limiting** — o Fitbit impõe 150 req/hora por usuário; esta API não faz throttle nem cache.

API backend desenvolvida com NestJS para integração com a API do Fitbit. POC que permite médicos monitorarem dados de saúde de seus pacientes através de relógios Fitbit (Flex 2 e Inspire HR).

## Sumário

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Instalação](#instalação)
  - [Pré-requisitos](#pré-requisitos)
  - [1. Clone e instale](#1-clone-e-instale)
  - [2. Suba o banco de dados](#2-suba-o-banco-de-dados)
  - [3. Configure as variáveis de ambiente](#3-configure-as-variáveis-de-ambiente)
  - [4. Registre sua aplicação no Fitbit](#4-registre-sua-aplicação-no-fitbit)
  - [5. Inicie o servidor](#5-inicie-o-servidor)
- [Interface Web](#interface-web)
- [Endpoints](#endpoints)
  - [Autenticação Fitbit](#autenticação-fitbit)
  - [CRUD de Usuários](#crud-de-usuários)
  - [Dados Fitbit por Usuário](#dados-fitbit-por-usuário)
  - [Visão do Médico (dados dos pacientes)](#visão-do-médico-dados-dos-pacientes)
  - [Endpoints diretos (acesso com Fitbit token via header)](#endpoints-diretos-acesso-com-fitbit-token-via-header)
  - [Sessões e Tempo Real](#sessões-e-tempo-real)
- [Cobertura de Dados](#cobertura-de-dados)
- [Glossário de Métricas de Saúde](#glossário-de-métricas-de-saúde)
  - [Passos (Steps)](#passos-steps)
  - [Calorias (Calories)](#calorias-calories)
  - [Distância (Distance)](#distância-distance)
  - [Andares e Elevação (Floors & Elevation)](#andares-e-elevação-floors--elevation)
  - [Minutos Ativos (Active Minutes)](#minutos-ativos-active-minutes)
  - [Frequência Cardíaca (Heart Rate)](#frequência-cardíaca-heart-rate)
  - [Active Zone Minutes (AZM)](#active-zone-minutes-azm)
  - [Sono (Sleep)](#sono-sleep)
  - [VO2 Max (Aptidão Cardiovascular)](#vo2-max-aptidão-cardiovascular)
  - [Breathing Rate (Taxa Respiratória)](#breathing-rate-taxa-respiratória)
  - [Dados de Perfil (Profile)](#dados-de-perfil-profile)
  - [Dispositivos e Histórico de Sync](#dispositivos-e-histórico-de-sync)
- [Métricas Não Implementadas: AZM e Breathing Rate](#métricas-não-implementadas-azm-e-breathing-rate)
- [Limitações e Considerações](#limitações-e-considerações)
  - [Dados Intraday (403 Forbidden)](#dados-intraday-403-forbidden)
  - [Rate Limits](#rate-limits)
  - [Expiração de Tokens](#expiração-de-tokens)
  - [Dias sem o relógio](#dias-sem-o-relógio)
  - [Limitações de Hardware (Flex 2 e Inspire HR)](#limitações-de-hardware-flex-2-e-inspire-hr)
  - [Deploy atrás de Reverse Proxy / Subpath](#deploy-atrás-de-reverse-proxy--subpath)
- [Próximos Passos](#próximos-passos)
  - [Metas Diárias por Paciente](#metas-diárias-por-paciente)
  - [Outros Candidatos](#outros-candidatos)

## Sobre o Projeto

Sistema com cadastro de médicos e pacientes, autenticação OAuth2 com Fitbit, coleta automática de dados de saúde e interface web para visualização. O médico visualiza dados de todos os seus pacientes vinculados em um único painel.

## Funcionalidades

- Autenticação OAuth2 com Fitbit (Authorization Code Grant)
- CRUD de usuários (médicos e pacientes)
- Vinculação médico -> pacientes
- Persistência de tokens Fitbit no banco (PostgreSQL)
- Auto-refresh de tokens (buffer de 15 min antes da expiração)
- Cron job a cada 10 min para verificar sync dos dispositivos
- Histórico de sincronizações por dispositivo (entidade `SyncHistory` — armazena `deviceId`, `batteryLevel` %, modelo, tipo e timestamp de sync), com throttle de uma entrada a cada 30 minutos, exceto se a bateria cair 5% ou mais
- Gráfico temporal de bateria (Chart.js) com filtro por dispositivo, intervalo de datas e seleção individual de entradas
- Dados de atividade, sono, frequência cardíaca, perfil e dispositivos
- Painel de sono com detalhamento por registro (sono principal + cochilos), comparação com média de 30 dias por estágio, métricas de latência do sono e despertar noturno, e gráfico de timeline com linhas de transição entre estágios e tooltips ao passar o mouse
- Time series e intraday (minuto a minuto)*
- Subscriptions (webhooks) e SSE para dados em tempo real
- Interface web para gerenciamento e visualização
- Deploy via Docker (`Dockerfile` multi-stage + Docker Compose para API e banco)
- Deploy compatível com reverse proxy / subpath (suporte a `X-Forwarded-Prefix` e base path dinâmico no frontend)

* Dados intraday requerem aplicação tipo "Personal" ou aprovação especial do Fitbit.

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
docker compose up -d postgres
```

> Rodar `docker compose up -d` sem argumentos sobe **tanto** o banco PostgreSQL quanto o container da API (construído a partir do `Dockerfile`). Use essa opção no lugar dos passos 3–5 para um setup totalmente containerizado — só garanta que o arquivo `.env` (passo 3) já exista, já que o container da API o carrega via `env_file`.

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

|Página|Descrição|
|---|---|
|**Dashboard**|Visão geral com contadores (total de usuários, médicos, pacientes, conectados ao Fitbit)|
|**Usuários**|CRUD completo - cadastrar, editar e remover médicos e pacientes. Vincular paciente a médico. Botão para conectar/desconectar Fitbit|
|**Dados Resumidos**|Selecionar um médico e visualizar dados de todos os pacientes por abas: Atividade, Sono, Semana, Perfil e **Dispositivos**. A aba Dispositivos exibe dados ao vivo do dispositivo e histórico de sync com gráfico de bateria % por paciente|
|**Dados Completos**|Selecionar um médico e visualizar todos os dados consolidados de cada paciente (atividade + sono + FC + perfil + dispositivos + histórico de sync com gráfico de bateria %)|

Além disso, a página `/fitbit/connect` fornece a interface para o fluxo OAuth2 de vinculação do Fitbit a um usuário.

## Endpoints

### Autenticação Fitbit

|Método|Endpoint|Descrição|
|---|---|---|
|GET|`/fitbit/auth?userId=:id`|Inicia fluxo OAuth2 (redireciona para Fitbit)|
|GET|`/fitbit/callback`|Callback do OAuth2 (chamado pelo Fitbit)|
|POST|`/fitbit/refresh`|Renova access token (body: `{ "refreshToken": "..." }`)|
|GET|`/fitbit/connect`|Página web para conectar Fitbit|

### CRUD de Usuários

|Método|Endpoint|Descrição|
|---|---|---|
|POST|`/users`|Criar usuário (médico ou paciente)|
|GET|`/users`|Listar todos os usuários|
|GET|`/users/doctors`|Listar médicos|
|GET|`/users/patients`|Listar pacientes|
|GET|`/users/:id`|Buscar usuário por ID|
|PUT|`/users/:id`|Atualizar usuário|
|DELETE|`/users/:id`|Remover usuário|

### Dados Fitbit por Usuário

|Método|Endpoint|Descrição|
|---|---|---|
|GET|`/users/:id/fitbit/activity?date=YYYY-MM-DD`|Atividade diária|
|GET|`/users/:id/fitbit/sleep?date=YYYY-MM-DD`|Dados de sono|
|GET|`/users/:id/fitbit/week?weekStart=YYYY-MM-DD`|Dados de 7 dias (atividade + sono)|
|GET|`/users/:id/fitbit/heart-rate?date=YYYY-MM-DD`|Frequência cardíaca intraday|
|GET|`/users/:id/fitbit/time-series?resource=steps&startDate=...&endDate=...`|Time series por período|
|GET|`/users/:id/fitbit/intraday?resource=steps&startDate=...&endDate=...`|Intraday minuto a minuto|
|GET|`/users/:id/fitbit/profile`|Perfil Fitbit (nome, idade, altura, peso)|
|GET|`/users/:id/fitbit/devices`|Dispositivos e último sync|
|GET|`/users/:id/fitbit/sync-history?limit=20`|Histórico de sincronizações (inclui `batteryLevel` % e `deviceId` por registro)|
|GET|`/users/:id/fitbit/cardio-score?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`|Estimativa de VO2 Max (Cardio Fitness Score)|
|GET|`/users/:id/fitbit/all?date=YYYY-MM-DD`|Todos os dados do dia (atividade + sono + FC)|
|POST|`/users/:id/fitbit`|Vincular tokens Fitbit ao usuário|
|DELETE|`/users/:id/fitbit`|Desconectar Fitbit do usuário|

### Visão do Médico (dados dos pacientes)

|Método|Endpoint|Descrição|
|---|---|---|
|GET|`/users/:id/patients`|Listar pacientes do médico|
|GET|`/users/:id/patients/fitbit/activity?date=...`|Atividade de todos os pacientes|
|GET|`/users/:id/patients/fitbit/sleep?date=...`|Sono de todos os pacientes|
|GET|`/users/:id/patients/fitbit/week?weekStart=...`|Dados semanais de todos os pacientes|
|GET|`/users/:id/patients/fitbit/profile`|Perfil Fitbit de todos os pacientes|
|GET|`/users/:id/patients/fitbit/all?date=...`|Todos os dados de todos os pacientes|

### Endpoints diretos (acesso com Fitbit token via header)

Estes endpoints aceitam um Fitbit access token diretamente via header `Authorization: Bearer <fitbit_token>`, sem necessidade de um usuário cadastrado no sistema.

|Método|Endpoint|Descrição|
|---|---|---|
|GET|`/fitbit/activity?date=...`|Atividade|
|GET|`/fitbit/sleep?date=...`|Sono|
|GET|`/fitbit/week?weekStart=...`|Dados semanais|
|GET|`/fitbit/time-series?resource=...&startDate=...&endDate=...`|Time series|
|GET|`/fitbit/intraday?resource=...&startDate=...&endDate=...`|Intraday|
|GET|`/fitbit/heart-rate-intraday?date=...`|FC intraday|
|POST|`/fitbit/refresh`|Renovar token (body: `{ "refreshToken": "..." }`)|

### Sessões e Tempo Real

|Método|Endpoint|Descrição|
|---|---|---|
|POST|`/fitbit/session/:sessionId/patient`|Adicionar paciente à sessão|
|DELETE|`/fitbit/session/:sessionId/patient/:patientId`|Remover paciente da sessão|
|SSE|`/fitbit/session/:sessionId/live`|Stream de dados em tempo real|
|DELETE|`/fitbit/session/:sessionId`|Encerrar sessão|
|POST|`/fitbit/webhook`|Receber notificações do Fitbit|

## Cobertura de Dados

Referência completa de todos os tipos de dados disponíveis na [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/), mostrando o que esta API implementa para cada dispositivo usado nesta POC.

**Sensores disponíveis por dispositivo:**

|Sensor|Flex 2|Inspire HR|
|---|:-:|:-:|
|Acelerômetro 3 eixos|✅|✅|
|Monitor óptico de freq. cardíaca|❌|✅|
|GPS (conectado ao celular)|❌|✅|
|Altímetro|❌|❌|
|Sensor SpO2|❌|❌|
|Sensor de temperatura|❌|❌|
|Resistência à água|50m|50m|

**Cobertura de dados por dispositivo:**

|Categoria|Dado|Fitbit API|Flex 2|Inspire HR|Observações|
|---|---|:-:|:-:|:-:|---|
|**Atividade**|Passos|✅|✅|✅||
||Calorias|✅|✅|✅|Retorna só TMB se relógio não usado — veja [nota](#dias-sem-o-relógio)|
||Distância|✅|✅|✅||
||Andares / Elevação|✅|❌|❌|Sem altímetro em ambos — sempre retorna 0|
||Minutos ativos (sedentário/leve/moderado/intenso)|✅|✅|✅||
||Active Zone Minutes (AZM)|✅|❌|⚠️|Flex 2 sem HR; não implementado nesta API|
||Intraday de atividade|✅|✅|✅|Requer app tipo Personal|
|**Sono**|Resumo de sono|✅|✅|✅||
||Estágios (light/deep/REM)|✅|❌|✅|Flex 2 retorna sono básico (awake/asleep/restless)|
||Sleep time series|✅|❌|❌|Não implementado|
|**Freq. Cardíaca**|FC diária (zonas + repouso)|✅|❌|✅|Flex 2 sem sensor HR|
||FC intraday|✅|❌|✅|Flex 2 sem sensor HR|
||Variabilidade da FC (HRV)|✅|❌|❌|Nenhum dos dois suporta HRV|
|**Respiração**|Breathing rate|✅|❌|⚠️|Apenas durante o sono; não implementado — veja [nota](#métricas-não-implementadas-azm-e-breathing-rate)|
|**Temperatura**|Temperatura da pele|✅|❌|❌|Sem sensor em ambos|
||Temperatura corporal (manual)|✅|❌|❌|Entrada manual apenas|
|**Oxigenação**|SpO2|✅|❌|❌|Sem sensor em ambos|
|**Cardio Fitness**|VO2 Max|✅|❌|✅|Flex 2 sem HR; requer scope `cardio_fitness`|
|**Corpo**|Peso / IMC|✅|⚠️|⚠️|Não implementado; requer entrada manual ou balança Aria|
||Gordura corporal|✅|❌|❌|Requer balança Aria|
|**Nutrição**|Alimentos / Água|✅|❌|❌|Entrada manual apenas|
|**ECG / IRN**|Eletrocardiograma|✅|❌|❌|Apenas Sense / Sense 2|
|**Perfil**|Dados do usuário|✅|✅|✅||
|**Dispositivos**|Lista + histórico de sync|✅|✅|✅||
|**OAuth**|Auth + refresh de token|✅|✅|✅||
|**Subscriptions**|Webhooks|✅|✅|✅||

**Legenda**: ✅ implementado e funcional | ❌ indisponível (sem hardware ou sem suporte na Fitbit API) | ⚠️ hardware/API suporta, mas não implementado nesta API

> **Resumo**: O **Inspire HR** fornece dados significativamente mais ricos que o **Flex 2** graças ao sensor de frequência cardíaca, que habilita estágios de sono, zonas de FC, VO2 Max e breathing rate. O **Flex 2** é limitado a dados baseados em acelerômetro (passos, distância, sono básico). Nenhum dos dois modelos possui sensores de SpO2, temperatura, ECG ou altímetro.

## Glossário de Métricas de Saúde

Guia de referência para cada métrica de saúde que esta API pode coletar, o que ela mede e sua relevância clínica.

---

### Passos (Steps)

Total de passos dados no dia, detectados pelo acelerômetro de 3 eixos do dispositivo. Um dos indicadores de atividade mais básicos. Estudos epidemiológicos em larga escala (meta-análise de 15 coortes internacionais publicada no _The Lancet Public Health_, 2022) associam benefícios significativos de mortalidade a partir de 7.000–8.000 passos/dia para adultos, o que corresponde aproximadamente à recomendação da OMS de 150 minutos/semana de atividade moderada. A meta popular de 10.000 passos/dia tem origem em uma campanha de marketing japonesa dos anos 1960, não em evidência científica direta. Útil para rastrear tendências de sedentarismo em pacientes ao longo do tempo.

> **Nota**: A OMS não emite recomendações em passos por dia — suas diretrizes são expressas em minutos e intensidade de atividade física (150–300 min/semana de intensidade moderada ou 75–150 min/semana de intensidade vigorosa).

---

### Calorias (Calories)

**Calorias totais (caloriesOut)**: Todas as calorias que o corpo queimou no dia — taxa metabólica basal (TMB) mais calorias de atividade.

**TMB (caloriesBMR)**: Calorias queimadas em repouso apenas para sustentar funções vitais (respiração, circulação, reparo celular). Estimado a partir do perfil do usuário (idade, altura, peso, gênero).

**Calorias de atividade (activityCalories)**: Calorias queimadas acima da TMB devido a movimento e exercício.

---

### Distância (Distance)

Distância total percorrida estimada (km), calculada a partir da contagem de passos e comprimento de passada configurado no perfil Fitbit do usuário. Menos precisa sem GPS — o Inspire HR usa GPS conectado (via celular) para atividades ao ar livre.

---

### Andares e Elevação (Floors & Elevation)

Número de andares subidos e ganho de elevação em metros, medido por altímetro. **Nem o Flex 2 nem o Inspire HR possuem altímetro**, portanto esses valores sempre retornam 0 para ambos os dispositivos.

---

### Minutos Ativos (Active Minutes)

Tempo em diferentes intensidades de atividade física, classificado por METs (Equivalente Metabólico de Tarefa):

|Campo|Intensidade|METs|
|---|---|---|
|`sedentaryMinutes`|Sentado / sem movimento|< 1,5|
|`lightlyActiveMinutes`|Atividade leve (caminhada lenta)|1,5–2,9|
|`fairlyActiveMinutes`|Atividade moderada (caminhada rápida)|3–5,9|
|`veryActiveMinutes`|Atividade intensa (corrida)|≥ 6|

A OMS recomenda 150 min/semana de atividade moderada a intensa (≥ 21 min/dia de `fairlyActive` + `veryActive`).

---

### Frequência Cardíaca (Heart Rate)

O Inspire HR mede a frequência cardíaca continuamente por fotopletismografia óptica (PPG) — um LED verde que detecta variações no volume sanguíneo no pulso.

**Frequência cardíaca de repouso (restingHeartRate)**: Estimada pelo algoritmo proprietário do Fitbit a partir de dados coletados durante períodos de menor atividade, tanto em vigília quanto durante o sono. Uma FC de repouso menor geralmente indica melhor aptidão cardiovascular. Faixa normal: 60–100 bpm; atletas podem ficar abaixo de 60.

**Zonas de frequência cardíaca**: O Fitbit calcula a FC máxima estimada usando a fórmula padrão (220 − idade) e, em dispositivos com sensor HR (como o Inspire HR), personaliza as zonas utilizando a **reserva de frequência cardíaca** (método de Karvonen): `FC zona = FC repouso + (porcentagem × (FC máx − FC repouso))`. Isso significa que as zonas se ajustam automaticamente conforme a aptidão cardiovascular do usuário muda.

As faixas aproximadas de referência são:

|Zona|Descrição|Benefício|
|---|---|---|
|Out of Range|Abaixo da zona Fat Burn|Atividade cotidiana|
|Fat Burn|Intensidade baixa a moderada|Metabolismo de gordura|
|Cardio|Intensidade moderada a alta|Resistência cardiovascular|
|Peak|Intensidade máxima|Desempenho anaeróbico|

> **Nota**: Os limites exatos de cada zona variam por indivíduo porque são calculados a partir da reserva de FC (FC máx − FC repouso), não de porcentagens fixas sobre a FC máxima. Os valores podem ser consultados na seção Active Zone Minutes do app Fitbit. O usuário também pode definir uma FC máxima personalizada no app para ajustar as zonas.

---

### Active Zone Minutes (AZM)

Métrica própria do Fitbit que contabiliza o tempo em zonas elevadas de frequência cardíaca ao longo do dia, ponderado pela intensidade:

|Zona|Pontos por minuto|
|---|---|
|Fat Burn|1 ponto|
|Cardio|2 pontos|
|Peak|2 pontos|

A meta padrão é 22 AZM/dia (equivalente à recomendação da AHA/OMS de 150 min/semana de atividade moderada ou 75 min/semana de atividade vigorosa). Útil para rastrear se o paciente está cumprindo as diretrizes de atividade física.

> **Nota**: Não implementado nesta API — veja a seção [Métricas Não Implementadas](https://claude.ai/chat/a540099a-937b-4c4a-91f2-b71e13f68b1e#m%C3%A9tricas-n%C3%A3o-implementadas-azm-e-breathing-rate).

---

### Sono (Sleep)

Os dados de sono resumem cada sessão de sono registrada automaticamente pelo dispositivo.

**Métricas de duração**:

- `totalMinutesAsleep`: Tempo efetivamente dormindo (excluindo períodos acordado)
- `totalTimeInBed`: Tempo total entre início do sono e despertar
- `efficiency`: `(minutesAsleep / timeInBed) × 100`. Valores acima de 85% são geralmente considerados saudáveis na literatura de medicina do sono

**Estágios do sono** (requer sensor de frequência cardíaca — disponível no Inspire HR, não no Flex 2):

|Estágio|Descrição|% típica do sono|
|---|---|---|
|Sono leve|Fase de transição, o corpo desacelera|45–55%|
|Sono profundo|Restauração física, função imunológica|10–25%|
|Sono REM|Consolidação da memória, sonhos|20–25%|
|Acordado|Despertares breves (normal se < 5% do tempo)|< 5%|

O Fitbit retorna dois formatos de dados de sono: **Stages** (com granularidade de 30 segundos, classificando em light/deep/REM/wake — requer sensor HR) e **Classic** (com granularidade de 60 segundos, classificando em asleep/restless/awake — usado quando não há sensor HR, como no Flex 2).

Estágios do sono perturbados estão associados a doenças cardiovasculares, diabetes e declínio cognitivo.

**Múltiplos registros por dia**: o Fitbit registra uma entrada por sessão de sono — o sono principal da noite (`isMainSleep: true`) mais eventuais cochilos. A interface web exibe um seletor de abas ("★ Sono Principal" / "◌ Cochilo N") com um painel individual por registro.

**Métricas adicionais por registro**:
- **Latência do sono**: tempo até adormecer, derivado da primeira entrada da timeline de estágios (`levels.data[0]`) quando ela é um segmento `wake`
- **Despertar noturno**: total de minutos de despertares breves durante a noite, somados a partir de `levels.shortData` do Fitbit (eventos `wake` de menos de um minuto, não contabilizados no resumo principal de estágios)
- **Comparação com média de 30 dias**: cada estágio (deep/light/REM/wake) é comparado com o `thirtyDayAvgMinutes` do Fitbit, exibido apenas para o registro de sono principal (cochilos não têm baseline de 30 dias)

**Gráfico de timeline do sono**: um gráfico canvas no estilo "swimlane", com uma faixa horizontal por estágio (profundo, leve, REM, total acordado, despertar noturno), construído a partir da timeline de estágios do Fitbit (`levels.data` / `levels.shortData`). Linhas verticais conectam transições consecutivas entre estágios, coloridas conforme o estágio de origem, e passar o mouse sobre um segmento exibe um tooltip com sua duração.

---

### VO2 Max (Aptidão Cardiovascular)

O VO2 Max (consumo máximo de oxigênio) é a taxa máxima com que o corpo consegue consumir oxigênio durante exercício intenso, expresso em **mL de O₂ por kg de peso corporal por minuto (mL/kg/min)**. É considerado um dos preditores mais fortes de saúde cardiovascular a longo prazo e mortalidade por todas as causas.

O Fitbit Inspire HR **estima** o VO2 Max usando dados de frequência cardíaca durante caminhadas ou corridas ao ar livre (com GPS conectado), combinados com a frequência cardíaca de repouso ao longo do tempo. Não requer teste laboratorial.

A API retorna o valor de duas formas: como uma **faixa em string** (ex.: `"40-44"`) quando não há dados de corrida com GPS disponíveis, ou como um **valor numérico único** (ex.: `"45"`) quando o usuário realizou corridas com GPS de pelo menos 10 minutos em terreno plano. O valor é sempre em mL/kg/min.

**Faixas de referência (adultos 30–39 anos):**

|Classificação|Mulheres (mL/kg/min)|Homens (mL/kg/min)|
|---|---|---|
|Excelente|> 45|> 52|
|Bom|38–45|44–52|
|Médio|32–37|37–43|
|Abaixo da média|26–31|31–36|
|Baixo|< 26|< 31|

> **Nota**: Estas faixas são baseadas em tabelas clássicas da ACSM (American College of Sports Medicine) e servem como referência geral. O Fitbit utiliza seu próprio sistema de classificação (Cardio Fitness Levels) com categorias de "Poor" a "Excellent", calculadas por idade e sexo, que podem diferir ligeiramente.

Os valores diminuem com a idade e o sedentarismo. Monitorar o VO2 Max ao longo do tempo pode ajudar médicos a avaliar a trajetória de aptidão cardiovascular de um paciente.

---

### Breathing Rate (Taxa Respiratória)

Número estimado de respirações por minuto durante o sono, derivado da análise de modulação respiratória sobre o sinal de fotopletismografia (PPG). O sensor óptico de frequência cardíaca do Inspire HR detecta variações sutis nos intervalos batimento a batimento (Inter-Beat Intervals / IBI), e a partir da modulação periódica causada pela respiração sobre esses intervalos, estima a taxa respiratória. Faixa normal durante o sono: **12–20 respirações/min**.

> **Nota técnica**: Embora frequentemente descrita como "derivada de VFC (variabilidade da frequência cardíaca)", a estimativa de breathing rate utiliza especificamente a modulação respiratória sobre os IBI extraídos do sinal de PPG, o que é tecnicamente distinto de métricas formais de VFC como RMSSD ou SDNN. A precisão é menor do que em dispositivos com sensor SpO2 (como Sense 2 ou Charge 6).

Taxa respiratória persistentemente elevada durante o sono pode indicar problemas respiratórios, ansiedade, apneia do sono ou deterioração da saúde cardiovascular.

> **Nota**: Não implementado nesta API — veja a seção [Métricas Não Implementadas](https://claude.ai/chat/a540099a-937b-4c4a-91f2-b71e13f68b1e#m%C3%A9tricas-n%C3%A3o-implementadas-azm-e-breathing-rate).

---

### Dados de Perfil (Profile)

Informações estáticas do usuário armazenadas na conta Fitbit: nome completo, data de nascimento, altura, peso, gênero, país, fuso horário e comprimentos de passada. Usadas para contextualizar métricas de saúde (ex.: cálculo de TMB, estimativa de VO2 Max).

---

### Dispositivos e Histórico de Sync

Informações sobre o wearable físico conectado à conta: nome do modelo, tipo (TRACKER/SCALE), nível de bateria (porcentagem), status da bateria (Full/Medium/Low/Empty) e timestamp do último sync. A API também armazena um `SyncHistory` local por dispositivo, permitindo rastrear tendências de bateria ao longo do tempo.

---

## Métricas Não Implementadas: AZM e Breathing Rate

### Active Zone Minutes (AZM)

Active Zone Minutes medem quanto tempo o usuário ficou em zonas de frequência cardíaca elevada ao longo do dia. A Fitbit Web API possui um endpoint dedicado para essa métrica e o hardware do Inspire HR suporta. No entanto, os dados de AZM já estão parcialmente disponíveis através do endpoint de atividade padrão (`summary.activeZoneMinutes`), tornando um endpoint dedicado redundante para esta POC. Pode ser adicionado em uma iteração futura caso seja necessário rastreamento granular de AZM.

### Breathing Rate (Taxa Respiratória)

A taxa respiratória (em respirações por minuto) é estimada pelo Inspire HR **apenas durante o sono**, utilizando análise de modulação respiratória sobre os intervalos batimento a batimento capturados pelo sensor óptico de PPG — o dispositivo não possui sensor SpO2. A Fitbit API expõe esses dados via `/1/user/-/br/date/[date].json` e requer o scope OAuth adicional `respiratory_rate`. Essa métrica não foi implementada pelos seguintes motivos:

1. **Cobertura apenas durante o sono**: os dados só estão disponíveis em períodos de sono, limitando sua utilidade clínica fora da análise de sono já coberta pelo endpoint de sono.
2. **Re-autorização de scope**: adicionar esse scope exige que todos os usuários existentes re-autorizem o aplicativo, o que é uma mudança disruptiva para uma POC.
3. **Precisão da estimativa no Inspire HR**: sem SpO2, a taxa respiratória é uma estimativa de menor precisão em comparação com dispositivos como o Sense 2. Em contexto clínico, apresentar dados respiratórios estimados sem comunicar claramente suas limitações pode ser enganoso.

Ambas as métricas permanecem candidatas viáveis para uma versão futura do sistema, especialmente se a frota de dispositivos for atualizada para modelos com sensor SpO2 (Sense 2, Charge 6).

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

### Dias sem o relógio

Quando o dispositivo não é usado durante o dia inteiro, a Fitbit API **não retorna zeros nem erro** — ela preenche o dia com uma estimativa de Taxa Metabólica Basal (TMB) calculada a partir do perfil do usuário (idade, altura, peso, gênero). Isso gera dados enganosos que podem aparecer mais altos do que em dias ativos:

|Campo|Valor quando o relógio não foi usado|
|---|---|
|`steps`|0–9|
|`sedentaryMinutes`|~1.440 (dia inteiro)|
|`caloriesOut`|~1.400–2.000 (estimativa pura de TMB)|
|Zonas de FC|1.440 min em "Out of Range"|

Esta API detecta esse padrão (`steps < 10` e `sedentaryMinutes > 1.400`) e exibe um banner de aviso na interface web, marcando o valor de calorias como estimativa de TMB e não como dado medido. **Esses dados devem ser desconsiderados em análises clínicas.**

### Limitações de Hardware (Flex 2 e Inspire HR)

- **Andares/elevação**: Ambos sem altímetro, endpoint retorna 0
- **Frequência cardíaca**: Flex 2 não possui sensor óptico de HR
- **Estágios de sono**: Flex 2 retorna apenas sono básico (awake/asleep/restless)
- **SpO2, temperatura, ECG, HRV**: Nenhum dos dois modelos possui esses sensores

### Deploy atrás de Reverse Proxy / Subpath

Ao rodar atrás de um reverse proxy (ex.: NGINX) sob um subpath (ex.: `https://exemplo.com/fitbit-api/`), a aplicação precisa conhecer esse prefixo para montar corretamente as URLs de redirect e as chamadas de API:

- **Redirect do callback OAuth**: `GET /fitbit/callback` lê o header `X-Forwarded-Prefix` para prefixar o redirect para `/fitbit/connect`. Configure seu reverse proxy para enviá-lo (ex.: `proxy_set_header X-Forwarded-Prefix /fitbit-api;` no NGINX).
- **Base de API do frontend**: a interface web (`public/index.html`, `public/fitbit-connect.html`) deriva a URL base da API a partir de `window.location.pathname` em tempo de execução, funcionando sob qualquer subpath sem configuração em tempo de build.

## Próximos Passos

Melhorias potenciais para futuras iterações deste projeto.

### Metas Diárias por Paciente

A Fitbit Web API suporta escrita de metas de atividade via:

```
POST /1/user/-/activities/goals/daily.json
  Body: type=steps&value=10000
```

Tipos de meta disponíveis: `steps`, `caloriesOut`, `distance`, `floors`, `activeMinutes`.

Como esta API já armazena o access token OAuth de cada paciente, um médico poderia definir metas em nome do paciente fazendo requisições de escrita usando esse token. Endpoint sugerido:

```
POST /users/:id/fitbit/goals
Body: { "steps": 10000, "caloriesOut": 2500, "activeMinutes": 30 }
```

> **Importante**: o paciente consentiu que o app lesse seus dados via OAuth. Definir metas remotamente em seu nome é tecnicamente possível, mas requer consentimento informado explícito do paciente.

### Outros Candidatos

| Funcionalidade | Observações |
|---|---|
| Autenticação JWT + guards por role | Proteger endpoints com roles DOCTOR/PATIENT |
| Active Zone Minutes (AZM) | Inspire HR suporta; disponível em `summary.activeZoneMinutes` |
| Breathing Rate | Inspire HR estima durante o sono; requer scope `respiratory_rate` |
| Histórico de Peso / IMC | Scope já autorizado; requer endpoint de Body Logs |
| SpO2 / HRV / Temperatura | Requer upgrade de hardware (Sense 2, Charge 6) |

