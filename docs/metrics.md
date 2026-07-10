# Referência de Métricas — Fitbit Health Monitor

Guia completo de todas as métricas coletadas pela API e exibidas na interface web. Para cada métrica: o que é, de onde vem, como é calculada (quando aplicável) e onde aparece no frontend.

---

## Sumário

- [Atividade](#atividade)
  - [Passos](#passos)
  - [Calorias Total](#calorias-total-caloriesout)
  - [Calorias de Atividade](#calorias-de-atividade-activitycalories)
  - [Calorias BMR](#calorias-bmr-caloriesbmr)
  - [Calorias Marginais](#calorias-marginais-marginalcalories)
  - [Distância](#distância)
  - [Andares e Elevação](#andares-e-elevação)
  - [Minutos por Intensidade](#minutos-por-intensidade)
- [Metas do Dia](#metas-do-dia)
- [Frequência Cardíaca](#frequência-cardíaca)
  - [FC de Repouso](#fc-de-repouso-restingheartrate)
  - [Zonas de Frequência Cardíaca](#zonas-de-frequência-cardíaca)
- [VO2 Max](#vo2-max)
- [Sono](#sono)
  - [Duração e Eficiência](#duração-e-eficiência)
  - [Estágios do Sono](#estágios-do-sono)
- [Perfil Fitbit](#perfil-fitbit)
- [Dispositivos](#dispositivos)
- [Histórico de Sincronização](#histórico-de-sincronização)
- [Dados Semanais](#dados-semanais)
- [Valores Calculados pelo Frontend](#valores-calculados-pelo-frontend)
  - [Classificação do VO2 Max](#classificação-do-vo2-max)
  - [Detecção de Relógio não Usado](#detecção-de-relógio-não-usado)
  - [Tempo Relativo de Sync](#tempo-relativo-de-sync)

---

## Atividade

**Endpoint de origem**: `GET /users/:id/fitbit/activity?date=YYYY-MM-DD`
**Campo na resposta**: `activity.summary`
**Aparece no frontend**: aba **Atividade** (Dados Resumidos) e seção **Atividade Completa** (Dados Completos)

---

### Passos

| Campo API | `summary.steps` |
|---|---|
| Tipo | `number` |
| Exemplo | `8432` |

Número total de passos contados pelo acelerômetro de 3 eixos do dispositivo. É a métrica de atividade mais básica,funciona em todos os modelos (Flex 2 e Inspire HR).

**Frontend**: exibido como valor principal no card de atividade (Dados Resumidos) e como item destacado na grade de Atividade Completa (Dados Completos).

---

### Calorias Total (`caloriesOut`)

| Campo API | `summary.caloriesOut` |
|---|---|
| Tipo | `number` |
| Exemplo | `2315` |

Total de calorias queimadas no dia inteiro: **BMR + calorias de atividade**. É o gasto energético completo estimado pelo Fitbit para o dia.

> **Atenção**: se o relógio não foi usado no dia, este valor reflete apenas o BMR estimado (~1.400–2.000 kcal) e não representa dados medidos. O frontend detecta esse padrão e exibe um banner de aviso — veja [Detecção de Relógio não Usado](#detecção-de-relógio-não-usado).

**Frontend**: exibido na aba Atividade (Dados Resumidos) e na grade de Atividade Completa. Quando o relógio não foi usado, aparece acinzentado com o rótulo "Cal. Total (TMB)".

---

### Calorias de Atividade (`activityCalories`)

| Campo API | `summary.activityCalories` |
|---|---|
| Tipo | `number` |
| Exemplo | `876` |

Calorias queimadas **acima do BMR** em decorrência de movimento e exercício. É a parte "extra" do gasto calórico — quanto o corpo gastou além do que gastaria em repouso total.

**Fórmula**: `caloriesOut − caloriesBMR ≈ activityCalories`

**Frontend**: exibido apenas na seção Atividade Completa (Dados Completos).

---

### Calorias BMR (`caloriesBMR`)

| Campo API | `summary.caloriesBMR` |
|---|---|
| Tipo | `number` |
| Exemplo | `1439` |

**Taxa Metabólica Basal** — calorias que o corpo queima em repouso absoluto para manter funções vitais: respiração, circulação, reparo celular, regulação de temperatura. Estimado pelo Fitbit com base nos dados do perfil do usuário: **idade, altura, peso e gênero**, usando a equação de Mifflin-St Jeor ou Harris-Benedict.

Não é uma medição direta — é sempre uma estimativa. Por isso é o valor que aparece quando o relógio não é usado (o Fitbit retorna o dia inteiro como se fosse só BMR).

**Frontend**: exibido apenas na seção Atividade Completa (Dados Completos).

---

### Calorias Marginais (`marginalCalories`)

| Campo API | `summary.marginalCalories` |
|---|---|
| Tipo | `number` |
| Exemplo | `612` |

Calorias adicionais além do gasto mínimo para ficar parado. Representa o custo calórico de toda atividade acima de simplesmente estar sentado/deitado. É diferente de `activityCalories` porque exclui a parte do BMR relacionada a ficar em pé/sedentário.

Uso clínico limitado; mais relevante para atletas e análises de performance.

**Frontend**: exibido apenas na seção Atividade Completa (Dados Completos).

---

### Distância

| Campo API | `summary.distances[0].distance` |
|---|---|
| Tipo | `number` (km) |
| Exemplo | `6.41` |

Distância total percorrida no dia em quilômetros. Calculada a partir do **número de passos × comprimento médio do passo** configurado no perfil do usuário no Fitbit. Sem GPS, a precisão depende do comprimento do passo cadastrado.

O Inspire HR tem GPS conectado (via smartphone), mas os dados de GPS não são usados neste cálculo diário — apenas em workouts rastreados com GPS ativo.

**Frontend**: exibido na aba Atividade (Dados Resumidos) e na grade de Atividade Completa, formatado com 2 casas decimais + "km".

---

### Andares e Elevação

| Campo API | `summary.floors` / `summary.elevation` |
|---|---|
| Tipo | `number` / `number` (metros) |
| Exemplo | `0` / `0.0` |

Andares subidos (contados por altímetro) e ganho de elevação em metros. **Nem o Flex 2 nem o Inspire HR possuem altímetro**, portanto esses valores sempre retornam `0` para ambos os modelos.

**Frontend**: exibido na aba Atividade (Dados Resumidos) e na grade de Atividade Completa. O valor zero é esperado e correto para esses modelos.

---

### Minutos por Intensidade

| Campo API | Descrição | METs |
|---|---|---|
| `summary.sedentaryMinutes` | Sentado / sem movimento | < 1,5 |
| `summary.lightlyActiveMinutes` | Atividade leve (caminhada lenta) | 1,5–2,9 |
| `summary.fairlyActiveMinutes` | Atividade moderada (caminhada rápida) | 3–5,9 |
| `summary.veryActiveMinutes` | Atividade intensa (corrida) | ≥ 6 |

Classificados com base em **METs (Equivalente Metabólico da Tarefa)** — razão entre o gasto calórico da atividade e o gasto em repouso. O Fitbit determina a intensidade combinando dados do acelerômetro com a frequência cardíaca (quando disponível).

A OMS recomenda ao menos 150 min/semana de atividade moderada a intensa, equivalendo a ~21 min/dia de `fairlyActive + veryActive`.

**Frontend**:
- Dados Resumidos: exibe apenas `veryActiveMinutes` com o rótulo "Min. Intensos"
- Dados Completos: exibe todos os 4 campos separados na grade de Atividade Completa

**Indicador "Min. Ativos (rec. OMS)"**: barra de progresso calculada pelo frontend (`activeMin = fairlyActiveMinutes + veryActiveMinutes`) comparada contra a recomendação da OMS/AHA — não é uma meta do Fitbit. Aparece em três lugares:
- Dados Resumidos (aba Atividade): `activeMin` do dia vs `OMS_DAILY_ACTIVE_MIN = 21`
- Dados Completos (seção Metas do Dia): mesmo cálculo do dia
- Dados Resumidos (aba Semana): soma de `activeMin` dos 7 dias vs `OMS_WEEKLY_ACTIVE_MIN = 150`

---

### Active Zone Minutes (`activeZoneMinutes`)

| Campo API | `summary.activeZoneMinutes` |
|---|---|
| Tipo | `number` ou objeto (`{ activeZoneMinutes }` / `{ totalMinutes }`, depende da versão da API) |

Métrica proprietária do Fitbit que pondera minutos de atividade por intensidade da frequência cardíaca (minutos em zona Cardio/Peak contam em dobro em relação à zona Fat Burn), somando contra a meta semanal de 150 "zone minutes" recomendada pela AHA. Só é retornada por dispositivos com sensor de FC.

**Frontend**: extraída via `getActiveZoneMinutes(summary)` (lida com o campo numérico ou aninhado) e exibida como item "Zona Ativa (min)" — Dados Resumidos (aba Atividade) e Dados Completos (Atividade Completa). Some do grid quando o campo não vem na resposta (ex: Flex 2, sem sensor de FC).

---

## Metas do Dia

**Endpoint de origem**: `GET /users/:id/fitbit/activity` (campo `activity.goals`)
**Aparece no frontend**: seção **Metas do Dia** (Dados Completos apenas)

Metas diárias configuradas pelo usuário no app Fitbit. São alvos pessoais, não referências clínicas.

| Campo API | Comparado contra | Rótulo no frontend |
|---|---|---|
| `goals.steps` | `summary.steps` | Meta Passos |
| `goals.caloriesOut` | `summary.caloriesOut` | Meta Calorias |
| `goals.distance` | `summary.distances[0].distance` | Meta Distância (km) |
| `goals.floors` | `summary.floors` | Meta Andares |
| `goals.activeMinutes` | `fairlyActiveMinutes + veryActiveMinutes` | Meta Min. Ativos |

> **Meta Min. Ativos**: `goals.activeMinutes` do Fitbit representa a meta combinada de minutos moderados + intensos (a mesma métrica usada pelo app oficial do Fitbit para o badge "Active Minutes"). Por isso o frontend soma `fairlyActiveMinutes + veryActiveMinutes` para comparar contra essa meta — usar só `veryActiveMinutes` subestimaria o progresso.

**Barras de progresso** (`renderProgressBar`): quando o valor real ultrapassa a meta, a barra visual trava em 100% (não faz sentido "estourar" a barra), mas o percentual exibido em texto mostra o valor real (ex: `124%`, `319%`), sem arredondar para baixo.

---

## Frequência Cardíaca

**Endpoint de origem**: `GET /users/:id/fitbit/all` (campo `heartRate`)
**Campo na resposta**: `heartRate['activities-heart'][0].value`
**Aparece no frontend**: seção **Frequência Cardíaca** (Dados Completos)
**Disponibilidade**: Inspire HR ✅ | Flex 2 ❌ (sem sensor óptico de HR)

---

### FC de Repouso (`restingHeartRate`)

| Campo API | `hrData.restingHeartRate` |
|---|---|
| Tipo | `number` (bpm) |
| Exemplo | `62` |

Frequência cardíaca média durante o período de menor atividade do dia, normalmente medida durante o sono profundo. É um dos indicadores cardiovasculares mais importantes — valores menores geralmente indicam melhor condicionamento.

- **Normal**: 60–100 bpm
- **Atletas**: pode ficar abaixo de 60 bpm (bradicardia fisiológica)
- **Elevada persistentemente** (> 100 bpm): pode indicar estresse, desidratação, infecção ou condição cardíaca

**Frontend**: exibido como card destacado na seção de Frequência Cardíaca.

---

### Zonas de Frequência Cardíaca

| Campo API | `hrData.heartRateZones[]` |
|---|---|
| Tipo | Array de objetos `{ name, minutes, caloriesOut, min, max }` |

Tempo (em minutos) e calorias gastas em cada faixa de FC, calculadas como percentual da **FC máxima estimada** = `220 − idade`.

| Zona | % da FC Máx | Benefício principal |
|---|---|---|
| Out of Range | < 50% | Atividade cotidiana, repouso |
| Fat Burn | 50–69% | Queima de gordura, resistência baixa |
| Cardio | 70–84% | Condicionamento cardiovascular |
| Peak | 85–100% | Performance anaeróbica, potência |

Cada zona retorna: `minutes` (tempo na zona) e `caloriesOut` (calorias queimadas nessa zona).

**Frontend**: exibido como barras horizontais coloridas (cinza / laranja / vermelho-coral / vermelho-escuro) com minutos e calorias ao lado. Se não houver dados de HR, exibe mensagem "Sem dados de zonas cardíacas".

---

## VO2 Max  

**Endpoint de origem**: `GET /users/:id/fitbit/cardio-score?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
**Campo na resposta**: `cardioScore[].value.vo2Max`
**Aparece no frontend**: aba **VO2 Max** (Dados Resumidos) e seção **VO2 Max** (Dados Completos)
**Disponibilidade**: Inspire HR ✅ | Flex 2 ❌ (requer sensor de HR)

VO2 Max (volume máximo de oxigênio) é a quantidade máxima de oxigênio que o corpo consegue consumir durante exercício intenso, expressa em **mL de O₂ por kg de peso corporal por minuto (mL/kg/min)**. É considerado um dos preditores mais fortes de saúde cardiovascular a longo prazo e mortalidade geral.

O Fitbit Inspire HR **estima** o VO2 Max usando dados de frequência cardíaca durante caminhadas ou corridas ao ar livre (com GPS do celular ativo) e combinado com a FC de repouso acumulada ao longo do tempo.

**A API retorna um intervalo** (ex: `"40-44"`) em vez de um valor preciso, refletindo o caráter estimado da medição. O Fitbit chama isso de **Cardio Fitness Score**.

**Dados disponíveis por entrada**:
- `dateTime`: data da entrada retornada pela API (formato `YYYY-MM-DD`) — **não é necessariamente a data em que a medição foi calculada**, ver nota abaixo
- `value.vo2Max`: intervalo em mL/kg/min (ex: `"37-41"`)

> **Atenção — preenchimento retroativo (forward-fill)**: o endpoint `cardioscore/date/{start}/{end}` retorna uma entrada para **cada dia do intervalo consultado**, mesmo quando não há medição nova naquele dia. Quando o relógio não sincroniza, o Fitbit repete o último valor conhecido sob as datas seguintes — já que o VO2 Max só pode ser recalculado a partir de dados enviados durante um sync, uma entrada datada de depois do último sync real nunca é uma medição nova, é sempre um eco do último valor.
>
> Por isso o frontend **não** usa a última entrada do array como "última medição". A função `getRealVo2Measurement(entries)` anda de trás pra frente a partir do fim do array enquanto o valor de `vo2Max` permanecer igual, e retorna a entrada mais antiga dessa sequência — ou seja, a primeira data (dentro da janela consultada) em que aquele valor apareceu. Quando a data real difere da última data do intervalo consultado, o frontend exibe um aviso: "⚠ Valor sem alteração desde {data} — dispositivo pode não ter sincronizado dados novos."

**Frontend**:
- Exibe o valor "real" mais recente (ver nota acima), calculado a partir da janela de 30 dias consultada
- Mostra classificação com cor (verde / verde-oliva / laranja / vermelho)
- Exibe data real da última medição, com aviso se o valor estiver desatualizado em relação ao fim do intervalo consultado
- Em Dados Resumidos: mostra tabela de histórico com todas as entradas (inclusive as repetidas) se houver mais de 1 registro

---

## Sono

**Endpoint de origem**: `GET /users/:id/fitbit/sleep?date=YYYY-MM-DD`
**Campo na resposta**: `sleep[0]` (sessão principal) e `summary`
**Aparece no frontend**: aba **Sono** (Dados Resumidos) e seção **Sono Completo** (Dados Completos)

---

### Duração e Eficiência

| Campo API | Rótulo no frontend | Descrição |
|---|---|---|
| `summary.totalMinutesAsleep` | Tempo Dormindo | Minutos realmente dormindo (excluindo períodos acordado na cama) |
| `summary.totalTimeInBed` | Tempo na Cama | Total entre deitar e levantar |
| `sleep[0].efficiency` | Eficiência | `(minutesAsleep / timeInBed) × 100` |
| `summary.totalSleepRecords` | Registros | Quantidade de sessões de sono registradas no dia |
| `sleep[0].minutesAwake` | Min. Acordado | Minutos acordado durante a noite (após adormecer) |
| `sleep[0].minutesAfterWakeup` | Min. Após Acordar | Minutos na cama após acordar definitivamente |
| `sleep[0].startTime` / `endTime` | Período | Horário de início e fim da sessão principal |

**Eficiência do sono**: valores acima de 85% são considerados saudáveis. Valores baixos podem indicar insônia, apneia ou distúrbios de sono.

---

### Estágios do Sono

| Campo API | Cor no frontend | Descrição | % ideal |
|---|---|---|---|
| `sleepLevels.deep.minutes` | Azul escuro (#3f51b5) | Sono profundo: restauração física, imunidade | 10–25% |
| `sleepLevels.light.minutes` | Azul (#2196f3) | Sono leve: transição, processamento de memória | 45–55% |
| `sleepLevels.rem.minutes` | Roxo (#9c27b0) | Sono REM: consolidação de memória, sonhos | 20–25% |
| `sleepLevels.wake.minutes` | Laranja (#ff9800) | Breves acordadas (normal se < 5% do tempo) | < 5% |

**Disponibilidade**: estágios detalhados (deep/light/REM) requerem sensor de frequência cardíaca. Disponível apenas no **Inspire HR**. O **Flex 2** retorna apenas sono básico: `awake`, `asleep`, `restless`.

**Frontend**: exibido como lista com quadrado colorido + nome + minutos. A seção só aparece se houver dados de estágios (`sleepLevels` não vazio).

---

## Perfil Fitbit

**Endpoint de origem**: `GET /users/:id/fitbit/profile`
**Campo na resposta**: `user`
**Aparece no frontend**: aba **Perfil** (Dados Resumidos) e seção **Perfil Fitbit** (Dados Completos)

Dados estáticos cadastrados na conta do usuário no Fitbit. Não são medições — são informações de contexto usadas para calcular outras métricas (BMR, VO2 Max, zonas de FC, distância).

| Campo API | Rótulo no frontend | Observação |
|---|---|---|
| `user.fullName` | Nome Fitbit | Nome completo cadastrado no Fitbit |
| `user.dateOfBirth` | Data de Nasc. | Usado para calcular idade |
| `user.gender` | Gênero | `MALE` / `FEMALE` |
| `user.height` | Altura | Em centímetros |
| `user.weight` | Peso | Em quilogramas — é o peso cadastrado manualmente ou via balança Aria, não uma medição do relógio |
| `user.strideLengthWalking` | Passo (caminhada) | Comprimento do passo em caminhada (m) — exibido em cm |
| `user.strideLengthRunning` | Passo (corrida) | Comprimento do passo em corrida (m) — exibido em cm |
| `user.timezone` | Timezone | Ex: `America/Sao_Paulo` |
| `user.country` | País | Código do país |

> **Sobre o peso**: o campo `weight` no perfil é o peso que o usuário digitou nas configurações da conta ou sincronizou via balança Fitbit Aria. Não é medido pelo relógio. Para histórico de pesagens com IMC, seria necessário o endpoint de Body Logs (`/body/log/weight`) — não implementado nesta API.

**Frontend**:
- Dados Resumidos: exibe todos os campos em grade
- Dados Completos: exibe a grade com idade calculada + linha de rodapé com data de nasc., timezone e país

---

## Dispositivos

**Endpoint de origem**: `GET /users/:id/fitbit/devices`
**Aparece no frontend**: aba **Dispositivos** (Dados Resumidos) e seção **Dispositivos** (Dados Completos)

Lista os dispositivos físicos vinculados à conta Fitbit do usuário.

| Campo API | Rótulo no frontend | Descrição |
|---|---|---|
| `deviceVersion` | Modelo | Nome do modelo (ex: `Inspire HR`, `Flex 2`) |
| `type` | Tipo | `TRACKER` (relógio/pulseira) ou `SCALE` (balança) |
| `battery` | Bateria | Status textual: `Full`, `Medium`, `Low`, `Empty` |
| `batteryLevel` | Bateria % | Percentual numérico (0–100) |
| `lastSyncTime` | Sync | Timestamp do último sync com o app Fitbit |

O `lastSyncTime` é também utilizado para o badge "Último sync: X min atrás" exibido no cabeçalho de cada card de paciente.

---

## Histórico de Sincronização

**Endpoint de origem**: `GET /users/:id/fitbit/sync-history?limit=N`
**Aparece no frontend**: seção **Histórico de Sincronização** (Dados Resumidos aba Dispositivos e Dados Completos)

Registro local armazenado no banco de dados desta API (entidade `SyncHistory`), populado pelo **cron job** executado a cada 10 minutos. Cada entrada representa uma verificação de sync de um dispositivo.

| Campo | Descrição |
|---|---|
| `syncTime` | Timestamp da verificação (quando o cron rodou) |
| `deviceId` | ID único do dispositivo no Fitbit |
| `deviceName` | Nome do modelo do dispositivo |
| `deviceType` | `TRACKER` ou `SCALE` |
| `battery` | Status textual da bateria no momento |
| `batteryLevel` | Percentual da bateria no momento (0–100) |

**Frontend**:
- Tabela com scroll (máx. 260px de altura) filtrável por dispositivo e intervalo de datas
- Gráfico de linha temporal (Chart.js) mostrando evolução do nível de bateria
- Checkbox por linha para incluir/excluir entradas individuais do gráfico
- Checkbox "selecionar todos" para visibilidade global

---

## Dados Semanais

**Endpoint de origem**: `GET /users/:id/fitbit/week?weekStart=YYYY-MM-DD`
**Aparece no frontend**: aba **Semana** (Dados Resumidos)

Retorna 7 dias consecutivos de dados de atividade, começando em `weekStart`. Cada dia contém o mesmo objeto `activity.summary` descrito na seção [Atividade](#atividade).

**Frontend exibe por paciente**:
- Total de passos nos 7 dias
- Média de passos por dia
- Barra "Min. Ativos (rec. OMS/semana)": soma de `fairlyActiveMinutes + veryActiveMinutes` dos 7 dias vs 150 min (ver [Minutos por Intensidade](#minutos-por-intensidade))
- Tabela dia a dia: data | passos | calorias

---

## Valores Calculados pelo Frontend

Estes valores não vêm diretamente da API Fitbit — são derivados ou calculados pelo frontend (`public/index.html`) a partir dos dados brutos.

---

### Classificação do VO2 Max

**Função**: `getVo2MaxCategory(vo2MaxStr)`

O Fitbit retorna o VO2 Max como um intervalo (ex: `"37-41"`). O frontend pega o **limite inferior** do intervalo e aplica uma classificação simplificada:

| Valor (mL/kg/min) | Classificação | Cor |
|---|---|---|
| ≥ 55 | Excelente | Verde (#388e3c) |
| 45–54 | Bom | Verde-oliva (#689f38) |
| 35–44 | Regular | Laranja (#f57c00) |
| < 35 | Baixo | Vermelho (#d32f2f) |

> **Nota**: as faixas variam por idade e gênero na literatura clínica. Esta classificação é uma simplificação para o contexto da POC, usando limites gerais sem distinção de sexo ou faixa etária. O README contém tabelas mais detalhadas por gênero e idade.

---

### Detecção de Relógio não Usado

**Função**: `watchNotWorn(summary)`

```js
return (summary.steps || 0) < 10 && (summary.sedentaryMinutes || 0) > 1400;
```

Quando o relógio não é usado por um dia inteiro, o Fitbit não retorna zeros — ele preenche o dia com uma estimativa de TMB (Taxa Metabólica Basal). O padrão resultante é: pouquíssimos passos (0–9) com praticamente todas as ~1.440 horas do dia classificadas como sedentárias.

**Consequências quando detectado**:
- Banner laranja de aviso exibido acima da seção de atividade
- Badge do paciente muda de "OK" (verde) para "Sem dados" (laranja)
- Valor de calorias fica acinzentado com rótulo "Cal. Total (TMB)"

---

### Tempo Relativo de Sync

**Função**: `formatSyncTime(dateStr)`

Converte o `lastSyncTime` ISO em formato legível combinando data absoluta e tempo relativo:

| Diferença | Exibição |
|---|---|
| < 1 min | `agora` |
| < 60 min | `X min atrás` |
| < 24h | `Xh atrás` |
| ≥ 24h | `Xd atrás` |

Formato completo: `DD/MM/AA HH:MM (X min atrás)`

---

### Outros Cálculos Menores

| Cálculo | Onde | Descrição |
|---|---|---|
| **Idade** | Aba Perfil, Dados Completos | `Math.floor((hoje − dateOfBirth) / 31.557.600.000 ms)` |
| **Comprimento do passo em cm** | Aba Perfil, Dados Completos | `strideLengthWalking × 100` (API retorna em metros) |
| **Tempo de sono formatado** | Aba Sono, Dados Completos | `Math.floor(min/60) + "h" + (min%60) + "m"` |
| **Dispositivo principal** | Cabeçalho Dados Completos | Dispositivo com `lastSyncTime` mais recente entre todos os vinculados |
