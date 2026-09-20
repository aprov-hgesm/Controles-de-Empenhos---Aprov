# Bloco 17.0 — Baseline de consumo do Firestore

## Objetivo

Congelar uma linha de base técnica e mensurável do consumo Firestore do EMPROVEX antes de qualquer otimização do Bloco 17.

Baseline de código: `main@f432b18e661f0ef1758a567caf7d72f883e1adb4`.

Este bloco **não altera o comportamento de produção**, não modifica `firestore.rules`, não muda autenticação, sessões, Google Drive, empenhos, NFs, telemetria ou limites de acesso. O objetivo é tornar o consumo atual auditável para que os próximos blocos consigam provar redução em vez de apenas presumir melhoria.

## 1. Banco de produção

O runtime de produção usa explicitamente:

- projeto: `gen-lang-client-0982077967`;
- databaseId: `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- integração: `getFirestore(app, firebaseConfig.firestoreDatabaseId)`.

Esse databaseId é um **banco nomeado**, não o `(default)`.

A documentação oficial atual do Google Cloud Firestore declara que bancos nomeados não qualificam para a free quota e são cobrados pelo uso. O estado de faturamento da conta/projeto não pode ser inferido do repositório e continua sendo uma verificação operacional separada.

Referências oficiais:

- https://cloud.google.com/firestore/pricing
- https://docs.cloud.google.com/firestore/quotas
- https://firebase.google.com/docs/firestore/security/rules-conditions

## 2. Baseline do lease/heartbeat

Configuração atual:

- limite externo: **2 sessões lógicas por workspace/UG**;
- slots: `slot-1` e `slot-2`;
- duração do lease: **10 minutos**;
- heartbeat: **5 minutos**;
- conta fundadora: isenta do limite.

A aquisição atual lê, dentro da transação:

1. o tombstone `sessionRevocations/{sessionId}`;
2. `slot-1`;
3. `slot-2`.

Depois grava o slot escolhido/possuído.

O problema de eficiência é que `renewWorkspaceSessionLeaseIfDue()` reutiliza `acquireWorkspaceSessionLease()`. Portanto, a renovação periódica repete a mesma busca de capacidade que faz sentido no login inicial.

### Custo explícito atual

Cada aquisição/renovação normal:

- **3 reads explícitas**;
- **1 write explícita**.

A cada 5 minutos:

- 12 renovações/hora;
- **36 reads explícitas por sessão/hora**;
- **12 writes explícitas por sessão/hora**.

Cenários teóricos, sem Rules, retries ou listeners:

| Cenário | Reads explícitas | Writes explícitas |
| --- | ---: | ---: |
| 50 sessões × 8h | 14.400 | 4.800 |
| 100 sessões × 8h | 28.800 | 9.600 |
| 100 sessões × 24h | 86.400 | 28.800 |

Esses valores são **baseline de código**, não faturamento oficial.

## 3. Security Rules: consumo invisível à telemetria local

`canAccessWorkspace(workspaceId)` depende de metadados de `workspaces` e `platformAccounts` usando `get()`/`exists()`.

A documentação oficial do Firebase informa que chamadas de acesso a documentos feitas pelas Security Rules executam operações de leitura faturáveis. Algumas chamadas podem ser reutilizadas/cacheadas dentro da mesma avaliação, então não é correto multiplicar mecanicamente cada `get()` do arquivo de Rules.

Consequência: o contador interno `emprovex-workspace-estimate` não deve ser apresentado como equivalente exato ao billing.

## 4. Listeners realtime de uma sessão externa

Além das coleções operacionais, uma sessão externa normalmente mantém listeners de infraestrutura:

- workspace lifecycle: 1;
- platform account lifecycle: 1;
- tombstone de revogação: 1;
- classes de empenho: 1;
- configuração Google Drive: 1;
- branding global: 1.

**Base persistente: 6 listeners Firestore por aba.**

Plano operacional por aba:

| Aba | Coleções realtime operacionais | Total mínimo estimado por aba |
| --- | ---: | ---: |
| Painel | 1 | 7 |
| Empenhos | 3 | 9 |
| Itens | 1 | 7 |
| Nova NF | 4 | 10 |
| Relatórios | 3 | 9 |
| Itens do Empenho | 1 | 7 |
| Cronogramas | 2 | 8 |

Esse total é um piso arquitetural aproximado para sessão externa ativa. Ele não inclui Auth, Google Drive OAuth ou chamadas HTTP que não são Firestore.

## 5. Navegação entre abas

O Bloco 14 reduziu listeners simultâneos mantendo apenas as coleções necessárias à aba atual. Isso protege conexões concorrentes, mas existe um efeito econômico:

- ao sair de uma aba, o listener secundário é desmontado;
- ao voltar, um novo `onSnapshot` é criado;
- o novo snapshot inicial pode reler toda a coleção correspondente.

Como o runtime atual não configura persistência offline do Firestore, reconexões também podem ser tratadas como consultas novas.

O 17.4 deverá otimizar esse ciclo sem simplesmente manter todas as coleções abertas permanentemente.

## 6. Multiaba

O controle de sessão usa `localStorage` para compartilhar `sessionId`/`browserInstanceId`, então várias abas do mesmo navegador ocupam uma única vaga lógica.

Isso **não compartilha os listeners Firestore**. Cada aba React pode abrir seu próprio conjunto de listeners.

O 17.2 deverá separar:

- identidade lógica da sessão;
- liderança do navegador;
- transporte de estado entre abas.

Meta: uma aba líder executa presença/listeners compartilháveis e as demais recebem eventos locais sempre que isso for seguro.

## 7. Branding público

`usePlatformBranding()` abre `onSnapshot(settings/global)` inclusive antes do login.

As Rules atuais possuem:

`allow read: if true;`

Como a marca está congelada e não possui mutação em runtime, esse listener não é necessário para uma identidade visual fixa.

O 17.3 deverá migrar o logo para asset estático e eliminar a leitura pública de Firestore sem reintroduzir upload/remoção de logo.

## 8. Superfície administrativa

A administração mantém aproximadamente quatro listeners realtime permanentes:

- branding;
- workspaces;
- platformAccounts;
- collection group de `sessionSlots`.

Além disso, `loadPlatformWorkspaceUsage()` faz **um `getDoc` por workspace/UG elegível por refresh**.

Logo:

- 10 UGs → 10 reads explícitas por refresh;
- 100 UGs → 100 reads explícitas por refresh.

O consumo do Cloud Monitoring é mantido conceitualmente separado do Firestore.

## 9. Leituras sob demanda relevantes

### Diagnóstico histórico

`scanHistoricalConsistency()` consulta em paralelo:

- coleção completa de empenhos;
- coleção completa de invoices;
- settings filtrados para locks SAG/NS.

É manual, não polling, mas seu custo cresce com o histórico.

### Exclusão protegida de empenho

Antes da transação, `discoverEmpenhoLinks()` executa três queries por `empenhoId`:

- invoices;
- alerts;
- cronogramas.

Depois ainda existem validações transacionais.

### Integridade NS/CNPJ

Os fluxos de NS e migração de CNPJ possuem leituras de descoberta e múltiplas leituras transacionais. São necessárias para integridade, mas parte delas não está refletida na estimativa atual por UG.

## 10. Limitações da telemetria atual

A telemetria por UG é uma **estimativa interna útil para comparação**, mas hoje não mede integralmente:

- dependent document reads das Security Rules;
- retries automáticos de transação;
- todos os scans históricos;
- todas as leituras de NS/CNPJ/exclusão;
- leituras administrativas;
- branding público;
- efeitos de reconnect de listeners;
- custo da própria gravação de `usageEstimates`.

As três fontes continuam separadas:

1. `emprovex-workspace-estimate` — estimativa interna por UG;
2. `google-cloud-monitoring` — métrica global real observável;
3. billing oficial — fonte financeira definitiva.

## 11. Ordem dos próximos blocos

- **17.1** — redesenho do lease/heartbeat;
- **17.2** — coordenação multiaba;
- **17.3** — branding estático e remoção da leitura pública;
- **17.4** — ciclo de vida dos listeners operacionais;
- **17.5** — estratégia para coleções históricas grandes;
- **17.6** — telemetria mais fiel;
- **17.7** — proteção contra consumo abusivo;
- **17.8** — testes de consumo/regressão;
- **17.9** — auditoria final de eficiência.

## 12. Critério do Bloco 17.0

O bloco está concluído quando:

- este baseline estiver versionado;
- o manifesto `ops/firestore-consumption-baseline.json` estiver presente;
- as fórmulas do heartbeat forem verificadas automaticamente;
- o guard 17.0 estiver na Application CI;
- nenhuma lógica de produção ou Firestore Rule tiver sido alterada;
- a CI completa permanecer verde.

O baseline é deliberadamente histórico: otimizações futuras podem reduzir seus números. Elas não podem apagar o registro do estado anterior que servirá de comparação.
