# MÓDULO 14 — Auditoria Estática Final (14.0 + 14.1)

Data: 2026-09-25.

## 1. Escopo e regra de execução

Este documento registra exclusivamente:
- **14.0 — Congelamento da baseline**;
- **14.1 — Auditoria estática final**.

Não foram executados nesta etapa:
- gates 14.2;
- testes de domínio;
- TypeScript;
- build;
- Firestore/Auth Emulator;
- suíte multi-tenant runtime;
- walking skeleton;
- Browser E2E;
- regressão completa;
- Application CI;
- PR;
- merge;
- deploy.

Nenhum arquivo funcional, Rule, API, dependência, workflow ou configuração foi alterado por 14.0/14.1.

## 2. Módulo 14.0 — baseline congelada

### 2.1 Branch e HEAD real

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch:
`feat/adm-deposito-phase-11-5-visual-ux`

HEAD real recuperado antes da auditoria:
`88dff395649f7700f2c9c080ba9d7de0acf13ae9`

Commit:
`docs(adm-deposito): atualizar handoff de prioridades`

Comparação com a referência conhecida `88dff395649f7700f2c9c080ba9d7de0acf13ae9`:
- status: **identical**;
- 0 commits à frente;
- 0 commits atrás;
- nenhum arquivo posterior à referência conhecida.

Portanto, `88dff395649f7700f2c9c080ba9d7de0acf13ae9` fica congelado como a **baseline oficial de entrada da campanha do Módulo 14**.

### 2.2 Branch versus main

No momento do congelamento:
- `main`: `55e53c6724f8bf34f0bfe94bc771150c5f009398`;
- branch do ADM: **191 commits à frente** da `main`;
- branch do ADM: **0 commits atrás** da `main`.

O diff acumulado contém, entre outros:
- páginas/componentes `app/adm-deposito/**` e `features/warehouse/**`;
- domínio/repositórios `lib/warehouse/**`;
- `firestore.rules`;
- guards e testes ADM;
- documentação oficial;
- ajustes de Application CI relacionados ao módulo.

Conclusão: **branch, main e produção não são equivalentes**.

### 2.3 Produção

A integração Vercel disponível nesta auditoria não expôs o projeto EMPROVEX; o único projeto visível na conexão era alheio ao repositório.

Assim:
- não foi possível provar qual SHA está publicado em produção;
- nenhum estado de produção foi inferido;
- a auditoria diferencia explicitamente branch, `main` e produção.

### 2.4 Estado modular

- Módulos 1–13: concluídos conforme memória oficial;
- 14.0: **CONCLUÍDO**;
- 14.1: **CONCLUÍDO** por inspeção estática;
- 14.2+: **NÃO INICIADO**;
- piloto ADM: founder-only;
- expansão externa: não autorizada.

## 3. Superfícies auditadas

Foram inspecionados, entre outros:
- `docs/adm-deposito/README.md`;
- `ROADMAP.md`;
- `DECISIONS.md`, com atenção a D-057, D-069 e D-070;
- `STATUS.md`;
- `HANDOFF_TEMPLATE.md`;
- `PHASE_13_HARDENING.md`;
- `MODULE_14_FINAL_VALIDATION_PLAN.md`;
- `POST_ADM_STABILIZATION_AND_SECURITY_PLAN.md`;
- `docs/EMPROVEX_CORE_PROTECTION.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`;
- `package.json` e `package-lock.json`;
- workflows de CI/Core Protection e Dependabot;
- `firebase.json`, `firebase.security-test.json` e `firestore.rules`;
- `security_spec.md`;
- `scripts/verify-emprovex-core-protection.mjs`;
- todas as rotas existentes em `app/api/**/route.ts`;
- gates client/server do warehouse;
- autenticação fundadora e resolução de workspace;
- sessão/lease;
- Google Drive;
- validação de PDF;
- superfícies e repositories warehouse relevantes.

## 4. Core Protection

Resultado estático: **ADERENTE**.

A fronteira permanece:

`EMPROVEX → leitura/projeção → ADM Depósito → warehouse/{workspaceId}/...`

Não foi observada nova dependência necessária do Core para warehouse.

O guard `scripts/verify-emprovex-core-protection.mjs` continua verificando por inspeção:
- imports warehouse proibidos em arquivos críticos;
- lifecycle de NF sem dependência do ADM;
- paths operacionais sem namespace warehouse;
- Rules operacionais sem autorização warehouse;
- ADM sem comandos de mutação do Core;
- telemetria best-effort.

O script foi **lido, não executado**, conforme o escopo de 14.1.

## 5. Autenticação e autorização

### 5.1 Fundador

Em Rules e servidor:
- e-mail verificado é obrigatório;
- provider fundador esperado permanece Google;
- identidade fundadora é conferida por e-mail autorizado;
- token precisa conter UID/`sub`;
- APIs administrativas/warehouse verificam token no servidor e não confiam apenas na UI.

`lib/server/firebaseFounderAuth.ts` valida token Bearer, e-mail verificado, identidade fundadora e provider esperado.

### 5.2 Setores externos

O modelo versionado continua baseado em:
- provider password;
- `platformAccounts`;
- workspace ativo;
- conta ativa;
- e-mail/UID vinculados;
- UG/workspace coerentes;
- sessão/lease para capacidade.

A visibilidade de rota/menu não é tratada como fronteira de segurança.

### 5.3 ADM Depósito

Founder-only permanece em três camadas:
1. gate client em `WarehouseProtectedSurface`;
2. gate server em `/api/adm-deposito/status` + `verifyWarehouseFounderRequest`;
3. Firestore Rules por `canAccessWarehouseModule(workspaceId)`.

No piloto, Rules exigem:
- workspace `hgesm-aprov`;
- UG `160416` quando aplicável;
- identidade fundadora.

Nenhuma permissão warehouse para setor externo foi identificada.

## 6. Firestore Rules

Resultado: **sem abertura operacional pública identificada**.

### 6.1 Warehouse

`warehouse/{workspaceId}` é protegido por `canAccessWarehouseModule(workspaceId)`.

Domínios warehouse possuem matches explícitos.

Confirmado por Rules:
- `movements`: create condicionado à operação válida; update/delete negados;
- `balances`: escrita apenas por validador derivado; delete negado;
- `locationBalances`: escrita apenas por validador derivado; delete negado;
- material canônico: delete físico negado;
- depósitos/localizações/lotes/barcodes/layouts/snapshots/destinos/retiradas/consumos/intakes/alertas/inventários: contratos explícitos e deletes históricos bloqueados conforme o domínio;
- inventário não recebe autorização genérica para gravar saldo fora das operações autorizadas.

### 6.2 Matches amplos/recursivos

Os matches recursivos encontrados para `sessionSlots` concedem somente leitura a administrador de plataforma; não concedem write a setores.

Não foi encontrado `allow write: if true`.

### 6.3 settings/global

A leitura pública deliberada permanece:

`settings/global → allow read: if true; allow write: if false`

Isso não é tratado como vazamento operacional no estado atual. O risco arquitetural é que qualquer dado futuro adicionado ao mesmo documento também passará a ser público.

## 7. Multi-tenant

Resultado estático: **ADERENTE, pendente de prova runtime em 14.5**.

Os paths operacionais e warehouse permanecem vinculados a workspace; UG é validada quando o contrato exige.

A segurança não depende apenas de filtro de interface:
- Core usa `canAccessWorkspace`/diretório de plataforma;
- warehouse usa Rules founder-only;
- APIs administrativas fazem autenticação server-side.

Não foi identificada permissão operacional global a setores externos.

## 8. APIs server-side

Rotas existentes no HEAD congelado:

| Rota | Classe | Método principal | Autorização | Rate limiting | Cache/erro |
|---|---|---|---|---|---|
| `/api/adm-deposito/status` | warehouse | GET | founder server-side | não necessário para mutação | cliente usa no-store; erro genérico de acesso |
| `/api/admin/auth-backup` | admin | GET | founder server-side | pre-auth + admin burst | tratamento estruturado |
| `/api/admin/delete-sector` | admin | POST | founder server-side | pre-auth + admin burst | gate de mutação + tratamento estruturado |
| `/api/admin/firebase-global-usage` | admin | GET | founder server-side | pre-auth + admin burst | diagnóstico controlado |
| `/api/admin/provision-sector` | admin | POST | founder server-side | pre-auth + admin burst | gate de mutação + validação |
| `/api/admin/reset-sector-password` | admin | POST | founder server-side | pre-auth + admin burst | gate de mutação + validação |
| `/api/admin/usage-alert-policy` | admin | GET | founder server-side | pre-auth + admin burst | diagnóstico controlado |
| `/api/cron/usage-snapshot` | cron | GET | Bearer `CRON_SECRET` | segredo cron | resposta não autorizada usa private/no-store |

Não foi identificado endpoint administrativo público.

As mutações administrativas inspecionadas consomem JSON pequeno e validam campos, porém não foi observado um limite explícito em bytes para o corpo HTTP. Isso fica como hardening de baixa severidade.

## 9. Segredos e credenciais

Resultado: **nenhum segredo privado versionado identificado na árvore auditada**.

A varredura de paths sensíveis encontrou apenas `.env.example`; não foram identificados:
- `.env.local`;
- `.env.production`;
- PEM;
- arquivo de service account;
- private key versionada.

`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` é lido apenas de `process.env` em código server-side.

`.env.example` contém placeholders vazios e instrui explicitamente a não usar `NEXT_PUBLIC_` para a credencial administrativa.

`CRON_SECRET` também é referência de ambiente.

A configuração Web do Firebase não é classificada como private key.

## 10. Google Drive e PDFs

### Google Drive

Confirmado:
- escopo OAuth: `drive.file`;
- access token temporário mantido em memória de runtime;
- nenhum refresh token persistido;
- runtime é limpo em expiração/troca de contexto;
- conta Google autorizada é conferida;
- fluxo externo de Drive não substitui o provider password da sessão Firebase;
- settings persistidos não incluem o access token.

### PDFs

`lib/pdfSecurity.ts` valida:
- MIME PDF quando aplicável;
- tamanho máximo;
- assinatura `%PDF-`.

O upload ao Drive:
- grava como `application/pdf`;
- valida metadata/MIME;
- compara tamanho;
- baixa novamente e verifica SHA-256;
- remove o upload se a verificação falhar.

## 11. Frontend/XSS e headers

Nos arquivos e superfícies diretamente inspecionados não foi observada utilização de:
- `dangerouslySetInnerHTML`;
- atribuição de `innerHTML`;
- `eval`;
- `new Function`.

Headers versionados:
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` restritiva para camera/microphone/geolocation.

**Content-Security-Policy não está configurada** no `next.config.ts` atual.

Não foi encontrada evidência estática de XSS explorável que transforme a ausência de CSP em bloqueio imediato.

## 12. Sessão

O repositório não chama explicitamente `setPersistence(browserLocalPersistence)` nem fixa o símbolo `browserLocalPersistence`; `lib/firebase.ts` instancia Auth com `getAuth()`.

Assim, a auditoria não registra “browserLocalPersistence explícito” como configuração versionada.

Separadamente, `platformSessionLease.ts` usa `localStorage` para metadados de lease/sessão lógica:
- browser instance id;
- session id;
- lease local;
- timestamp da última renovação.

Não foi identificado armazenamento de access token do Google Drive nesses registros.

Revogação, expiração, limite de sessão externa e renovação de lease permanecem implementados.

## 13. App Check

Confirmado no cliente:
- `initializeAppCheck`;
- `ReCaptchaEnterpriseProvider`;
- site key via `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`;
- auto-refresh;
- exclusão no modo de emulators/E2E.

Estado:
- implementação client-side: **CONFIRMADA**;
- enforcement no Firebase Console: **NÃO VERIFICÁVEL PELO REPOSITÓRIO**.

Não foi presumido enforcement.

## 14. Dependências

Versões resolvidas no `package-lock.json`:
- Next.js: **15.5.24**;
- React: **19.2.7**;
- React DOM: **19.2.7**;
- Firebase: **10.14.1**;
- jose: **6.2.12**;
- jsPDF: **2.5.2**;
- jspdf-autotable: **3.8.4**;
- pdf-lib: **1.17.1**.

### Next.js

A versão 15.5.24 coincide com o patch publicado para advisories críticos de agosto/2026 que afetavam versões anteriores a 15.5.24.

O advisory de 22/09/2026 para `next/og` afeta a linha 16.2.x–16.3.5, não a 15.5.24.

### jsPDF

A versão 2.5.2 está dentro das faixas afetadas por advisories de 2026, incluindo:
- `GHSA-wfv2-pwc8-crg5` — HTML injection em modos “newwindow” de `output`, corrigido em 4.2.1;
- `GHSA-7x6v-j9x4-qf24` — object injection em `createAnnotation`, corrigido em 4.2.1;
- `GHSA-9vjf-qc39-jprp` — object injection em `addJS`, corrigido em 4.2.0.

Nas superfícies diretamente inspecionadas nesta etapa:
- `lib/pdfToolkit.ts` apenas carrega dinamicamente jsPDF/autoTable;
- não foi observada chamada a `addJS`, `createAnnotation` ou aos overloads “newwindow” de `output`.

Conclusão estática: versão vulnerável presente, **sem caminho explorável confirmado nesta auditoria**. Deve ser tratada no hardening de dependências D-070 e reavaliada antes de expansão ampla.

Dependabot está configurado semanalmente para npm e GitHub Actions.

## 15. Integrações com IA

Não foi identificada dependência runtime de SDK OpenAI, Anthropic ou Gemini no `package.json`.

O fluxo SISCOFIS permanece conforme decisão oficial:
- IA externa/manual;
- operador fornece prompt;
- retorno entra no EMPROVEX como JSON;
- não existe integração runtime automática enviando Empenhos/NFs/NUP/estoque/usuários a um LLM.

## 16. Performance e Firestore

Resultado estático do ADM: **compatível com D-069**.

Evidências:
- consultas warehouse relevantes usam `limit(...)`;
- relatórios de movimentações/entradas usam até 250 movimentos conforme contrato;
- dashboard usa limites explícitos;
- SISCOFIS mantém `WAREHOUSE_SISCOFIS_MAX_ROWS = 500`;
- inventário e históricos possuem limites;
- otimizações usam `Map`/`Set` em memória;
- relatórios continuam derivados;
- não foi criada coleção `warehouse_report_*`;
- não existe cache/materialização paralela autorizada;
- não foi criado índice composto preventivo;
- não foi observado Firestore `onSnapshot` intencional nas superfícies warehouse auditadas; `WarehouseProtectedSurface` usa `onAuthStateChanged`, que é listener de Auth, não listener Firestore.

A confirmação dinâmica de consumo/listeners pertence às etapas posteriores e não foi simulada aqui.

## 17. security_spec.md

`security_spec.md` está **parcialmente obsoleto** para a arquitetura atual.

Exemplos:
- descreve isolamento primário por `userId`;
- afirma que cada usuário somente acessa documentos “próprios”;
- usa exemplos de paths raiz históricos.

A arquitetura vigente é workspace/UG + `platformAccounts` + Rules multi-tenant.

Fonte de verdade para segurança operacional:
1. `firestore.rules`;
2. documentos atuais de multi-tenancy/Core Protection;
3. decisões atuais do ADM.

O arquivo antigo não deve orientar novas regras sem atualização.

## 18. Repositório público e proteção de branch

Estado verificado:
- visibilidade: **public**;
- default branch: **main**;
- Dependabot: configurado;
- repository rulesets retornados pela integração: **nenhum**.

A leitura da proteção clássica de branch retornou `403 Resource not accessible by integration`; portanto branch protection clássica não pôde ser confirmada nem negada.

Repositório público não é tratado como vazamento por si só. O impacto é maior facilidade de reconhecimento; isso torna a disciplina de secrets, dependências e branch protection mais importante.

## 19. Produção versus branch

A branch atual contém 191 commits ainda ausentes da `main`, incluindo mudanças relevantes de:
- Rules warehouse;
- founder-only;
- domínio ADM;
- guards;
- documentação;
- CI relacionado ao módulo.

Essas proteções **não podem ser automaticamente consideradas publicadas**.

A produção EMPROVEX não pôde ser mapeada à integração Vercel disponível nesta auditoria.

## 20. Achados classificados

| ID | Severidade | Superfície | Achado | Impacto | Afeta | Ação | Etapa |
|---|---|---|---|---|---|---|---|
| A14-01 | MÉDIO | Dependências / jsPDF | jsPDF 2.5.2 está em faixas com advisories de 2026 | risco condicionado ao uso de APIs vulneráveis; caminho explorável não confirmado | branch e possivelmente main/produção conforme versão publicada | planejar upgrade/testes e revisar reachability | hardening D-070 |
| A14-02 | MÉDIO | Headers | ausência de CSP | reduz defesa em profundidade contra XSS caso surja um vetor | branch e possivelmente produção | desenhar CSP compatível com Firebase/Google Drive/Vercel | hardening D-070 |
| A14-03 | MÉDIO | App Check | cliente configurado, enforcement não verificável | proteção anti-abuso pode não estar efetiva no backend caso console não esteja enforced | estado externo | confirmar/enforçar gradualmente no Console antes de expansão | hardening D-070 |
| A14-04 | MÉDIO | Documentação | `security_spec.md` representa modelo antigo userId/root paths | risco de futuras mudanças de segurança usarem especificação errada | repositório | reescrever contra workspace/UG/platformAccounts | hardening D-070 |
| A14-05 | BAIXO | Firestore | `settings/global` é público por desenho | dado sensível futuro no mesmo doc se tornaria público | branch/main conforme Rules publicadas | manter somente branding público ou separar docs | hardening D-070 |
| A14-06 | BAIXO | APIs | mutações admin não mostram limite explícito de bytes do body | DoS/uso excessivo condicionado; já há rate limiting e schema pequeno | branch | adicionar limite defensivo quando revisar APIs | hardening D-070 |
| A14-07 | BAIXO | Sessão | persistence Firebase não está explicitamente fixada no código | comportamento depende do default do SDK/navegador; relevante em máquinas compartilhadas | branch/main | decidir e documentar política explícita | hardening D-070 |
| A14-08 | BAIXO | Supply chain | nenhum repository ruleset visível; proteção clássica não verificável pela integração | governança de branch não pôde ser provada | GitHub | revisar proteção/ruleset com permissão administrativa | bateria pós-ADM / D-070 |
| A14-09 | BAIXO | Firestore público | risco futuro de expansão indevida de `settings/global` | exposição somente se dados sensíveis forem adicionados | arquitetura | manter contrato mínimo/documentado | hardening D-070 |
| A14-10 | INFORMATIVO | Produção | SHA publicado não pôde ser provado | impede atribuir hardenings da branch à produção | produção | verificar em Vercel/ambiente correto durante fechamento | Módulo 14 |
| A14-11 | INFORMATIVO | GitHub | repositório é público | reconhecimento maior, sem secret exposto encontrado | repositório | manter secret hygiene/Dependabot | contínuo |

## 21. Ausência de bloqueio crítico

Nesta auditoria estática **não foi confirmada**:
- exposição de chave privada;
- Firestore operacional aberto;
- `allow write: if true`;
- bypass de autenticação;
- endpoint admin sem verificação server-side;
- acesso warehouse para setor externo;
- cross-tenant operacional confirmado;
- dependência necessária do Core em warehouse;
- integração runtime automática com LLM enviando dados;
- XSS explorável confirmado.

Logo, a exceção bloqueante da D-070 **não foi acionada**.

## 22. Limitações

14.1 é inspeção estática. Não prova:
- comportamento runtime real das Rules;
- isolamento cross-tenant em Emulator;
- App Check enforcement no Console;
- SHA realmente publicado em produção;
- estado de secrets configurados no ambiente;
- branch protection clássica do GitHub;
- ausência absoluta de vulnerabilidade transitiva em toda a árvore npm;
- comportamento sob concorrência real;
- Browser E2E.

Essas lacunas são deliberadamente cobertas por 14.2+ e pelo hardening posterior.

## 23. Gate

Classificação de saída: **B**.

Existem achados médios/baixos não bloqueantes e backlog de hardening, porém **nenhuma vulnerabilidade crítica/bloqueante foi confirmada**.

**O EMPROVEX está AUTORIZADO a avançar para o Módulo 14.2 quando a estação PowerShell estiver disponível.**

Essa autorização significa apenas que a auditoria estática não encontrou bloqueio. Não significa que os gates dinâmicos estejam aprovados, nem autoriza PR, merge, deploy ou expansão externa.
