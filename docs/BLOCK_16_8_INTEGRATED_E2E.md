# Bloco 16.8 — Testes E2E do conjunto completo

## Objetivo

Fechar a cobertura integrada dos Blocos 16.0 a 16.7 sem repetir testes já maduros, sem depender de serviços externos reais e sem alterar regras de negócio.

Baseline do bloco: `main@5cefae2319a28bbc50cbf3b14dafac0f26a4fa3c`.

## Estratégia

A suíte usa três camadas complementares:

1. **Browser E2E + Firebase Emulator** para os fluxos que dependem de navegador, localStorage/sessionStorage, autenticação externa por senha, lease e revogação em tempo real.
2. **Firebase Emulator multi-tenant já existente** para fronteiras de Rules, isolamento, administração, telemetria e concorrência de escrita.
3. **Testes determinísticos de contrato** para capacidade, limiares, política de alertas e Cloud Monitoring com respostas mockadas.

Nenhuma chamada real ao Google Cloud Monitoring ou ao Google Drive é necessária para o gate do Bloco 16.8.

## Matriz integrada

| Requisito | Cobertura |
| --- | --- |
| Login externo | Browser E2E existente `operator-critical-flow.spec.mjs` |
| Múltiplas abas no mesmo navegador | Browser E2E existente: mesma sessão lógica compartilha a vaga |
| Dois navegadores/sessões | Browser E2E existente |
| Terceira sessão bloqueada | Browser E2E existente |
| Logout libera slot imediatamente | Browser E2E existente |
| Lease de 10 min / heartbeat de 5 min | Novo Browser E2E + contrato determinístico |
| Retomada de slot expirado | Novo Browser E2E + Emulator multi-tenant |
| Corrida pelo último slot | Novo Browser E2E com duas tentativas simultâneas |
| Encerramento remoto | Emulator multi-tenant valida a transação administrativa; novo Browser E2E valida a reação do cliente à revogação |
| Tombstone impede retorno | Novo Browser E2E + Emulator multi-tenant |
| Novo login após revogação cria nova identidade | Novo Browser E2E |
| Isolamento entre UGs/workspaces | Emulator multi-tenant + Browser E2E existente |
| Fundador sem limite de slots | Contrato determinístico + Rules já testadas impedindo o fundador de consumir `sessionSlots` |
| Painel administrativo de sessões | Guard do componente + collection-group administrativo no Emulator |
| Telemetria estimada por UG | Novo Browser E2E observa buffer real; Emulator valida persistência/imutabilidade/UG |
| Refresh administrativo | Guard 16.7 preserva proteção por `requestSequence` nos três refreshes |
| Cloud Monitoring configurado | Novo teste determinístico mocka OAuth e cinco métricas, sem rede real |
| Cloud Monitoring não configurado | Novo teste garante fail-safe sem qualquer `fetch` |
| Política sem referências | Novo teste garante zero alertas e nenhuma franquia/cobrança presumida |
| Política com referências | Novo teste usa referências globais e por UG explícitas |
| 70%, 85%, 95% e >100% | Novo teste exercita exatamente as quatro faixas; 100% permanece crítico e >100% excedido |
| Métrica global vs estimativa interna vs cobrança | Novo teste mantém origens `global-real` e `workspace-estimate` distintas e proíbe campos de preço/cobrança |
| Concorrência otimista de empenhos | `test:empenho-concurrency` + Emulator multi-tenant já cobrem revisão e lost update |
| Google Drive / armazenamento documental | Guards Drive + testes de OAuth do Emulator já existentes continuam obrigatórios na Application CI |

## Novos cenários Browser E2E

Arquivo: `tests/e2e/block-16-integrated.spec.mjs`.

- heartbeat forçado de forma determinística por avanço do marcador local de renovação;
- retomada de slot já expirado;
- duas autenticações concorrentes disputando o último slot disponível;
- revogação administrativa observada em tempo real;
- tentativa deliberada de reciclar um `sessionId` revogado;
- login seguinte criando novo `sessionId`;
- verificação do buffer de telemetria do workspace/UG no navegador.

O teste usa somente o Firebase Emulator local. O acesso administrativo usado para preparar relógios/fixtures existe apenas no ambiente do Emulator e não é código de produção.

## Novos contratos determinísticos

Arquivo: `scripts/block-16-integrated-domain.test.mjs`.

- fundador ilimitado e setor externo limitado a 2;
- lease 10 min e heartbeat 5 min;
- faixas 70 / 85 / 95 / 100 / >100;
- política de alertas vazia e configurada;
- separação de origens de consumo;
- Cloud Monitoring não configurado sem chamada externa;
- Cloud Monitoring configurado com OAuth e respostas de métricas totalmente mockadas.

## CI permanente

A Application CI passa a executar:

- `test:block-16-8-integrated-domain`;
- `verify:block-16-8-integrated-e2e`.

A job já existente **Browser E2E with Firebase Emulator** descobre automaticamente o novo arquivo em `tests/e2e`, portanto não é criada uma segunda execução redundante de Chromium.

Os gates anteriores permanecem obrigatórios, inclusive:

- segurança multi-tenant;
- autenticação híbrida;
- UID binding;
- auditoria imutável;
- concorrência de empenhos;
- Google Drive;
- Blocos 16.0 a 16.7;
- Production Build;
- TypeScript;
- Diff Hygiene;
- Browser E2E;
- Final Release Gate.

## Restrições preservadas

- este bloco **não altera `firestore.rules`**;
- nenhum deploy manual ou de produção na Vercel faz parte do Bloco 16.8;
- PDFs e documentos continuam exclusivamente no Google Drive de cada workspace;
- Vercel Blob e Firebase Storage não são introduzidos para documentos;
- não existe nova fonte de verdade de consumo, sessão ou cobrança;
- Cloud Monitoring é testado sem credenciais reais e sem tráfego externo;
- a cobrança oficial continua fora do escopo das estimativas internas e dos alertas operacionais.
