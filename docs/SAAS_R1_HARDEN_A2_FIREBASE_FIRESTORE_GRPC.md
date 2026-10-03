# HARDEN-A2 — Firebase / Firestore / gRPC

Data da auditoria: **2026-10-03**

Branch: `saas-harden-a2-firebase-firestore-grpc`  
Base congelada: `f308ff601fe923467b8ccc1489be91b318bc3e8c`

## 1. Resultado executivo

**Estratégia aplicada: aceitação técnica documentada de risco residual.**

Nenhuma dependência foi alterada nesta frente.

A cadeia vulnerável permanece instalada por dependência transitiva do Firestore Node, porém os dois advisories raiz remanescentes de `@grpc/grpc-js` dependem de primitivas de **servidor gRPC** que não são usadas pelo EMPROVEX.

A linha oficial atual do Firebase/Firestore continua declarando `@grpc/grpc-js ~1.9.0`. Portanto:

- atualizar Firebase por major não elimina o achado;
- forçar `@grpc/grpc-js` para fora do range declarado pelo Firestore não é uma correção suportada;
- o override pode manter uma segunda cópia `1.9.16` dentro de `@firebase/firestore`;
- fazer downgrade de Firebase conforme sugestão automática do scanner não é aceitável;
- não há justificativa técnica para assumir regressão de Auth/Firestore/Central/Mobile apenas para reduzir o número do scanner.

Status recomendado da frente:

**PASS — RISCO RESIDUAL ACEITO TECNICAMENTE**

A aceitação de release continua sujeita à decisão consciente do Coordenador SaaS / Program Control antes do RC.

## 2. Integridade da base

A branch foi conferida antes da auditoria:

- HEAD inicial: `f308ff601fe923467b8ccc1489be91b318bc3e8c`;
- comparação branch vs. base: **identical**;
- ahead: **0**;
- behind: **0**.

A integradora avançou depois da base congelada apenas em documentação de coordenação. Nenhum merge/rebase foi feito nesta worker.

Também foi verificado que os blobs abaixo são idênticos entre o HEAD técnico validado da HARDEN-A1 (`5ae4984bb9580faf5197737eeeeb0d5cf5aae838`) e a base congelada da HARDEN-A2:

- `package.json`: `5d84e103f95d21b456f1e3beab991969bedf4369`;
- `package-lock.json`: `648f128824cc5d2e10d7e4db9444925b0df9fe34`;
- `lib/pdfToolkit.ts`: `808b73f46748218a44839135162153d1ff08c2af`.

Logo, a baseline de dependências auditada pela HARDEN-A1 é exatamente a mesma da HARDEN-A2.

## 3. Versões instaladas

### Firebase

Declarado em `package.json`:

`firebase: ^10.12.2`

Resolvido no lockfile:

`firebase: 10.14.1`

### Firestore

Resolvido:

`@firebase/firestore: 4.7.3`

Compat:

`@firebase/firestore-compat: 0.3.38`

O Firestore declara:

`@grpc/grpc-js: ~1.9.0`

### gRPC

Resolvido:

`@grpc/grpc-js: 1.9.16`

Caminho principal:

`firebase -> @firebase/firestore -> @grpc/grpc-js`

Não foi encontrado import direto de `@grpc/grpc-js` pelo código do EMPROVEX.

## 4. npm audit — baseline reproduzida

A HARDEN-A1 deixou a baseline:

- total: **12**;
- critical: **0**;
- high: **10**;
- moderate: **1**;
- low: **1**.

A mesma árvore de dependências foi reproduzida no Application CI da HARDEN-A1:

- run: `37114682161`;
- job: `111179072227`;
- `npm ci`: 476 pacotes adicionados / 477 auditados;
- resultado: **12 vulnerabilities (1 low, 1 moderate, 10 high)**.

Como os blobs de `package.json` e `package-lock.json` são idênticos na base congelada da A2, este é o audit baseline aplicável à frente.

Nenhum `npm audit fix --force` foi executado.

## 5. Advisories raiz da cadeia Firebase / Firestore / gRPC

O audit anterior contabiliza a cadeia como quatro pacotes HIGH:

- `firebase@10.14.1`;
- `@firebase/firestore@4.7.3`;
- `@firebase/firestore-compat@0.3.38`;
- `@grpc/grpc-js@1.9.16`.

Os advisories raiz são:

### GHSA-m9gg-hp2v-232j / CVE-2026-101916 — HIGH

Condição vulnerável:

- servidor gRPC;
- credenciais de servidor com `requireClientCertificate=false`;
- uso de `getAuthContext` como decisão de autenticação;
- caso especialmente relevante para determinadas configurações de `@grpc/grpc-js-xds` / RBAC.

Versões corrigidas publicadas pelo gRPC:

- `1.13.6`;
- `1.14.5`.

### GHSA-f596-whhp-79r4 / CVE-2026-101915 — LOW na origem

Condição vulnerável:

- aplicação usando `@grpc/grpc-js` para **executar servidor**;
- method handler lança/crasha;
- determinada mensagem de erro pode ser enviada ao cliente.

Versões corrigidas publicadas pelo gRPC:

- `1.13.6`;
- `1.14.5`.

## 6. Alcançabilidade — Browser

### Firebase Auth

Alcançável.

`lib/firebase.ts` usa o SDK Web de Auth.

Não depende dos comportamentos de servidor gRPC descritos pelos dois advisories.

### Firestore client

Alcançável.

`lib/firebase.ts` e `lib/firebaseSync.ts` usam `firebase/firestore`.

No browser, o Firestore Web utiliza transporte WebChannel, não o transporte Node `@grpc/grpc-js`.

Conclusão Browser:

**gRPC vulnerável não é carregado pelo runtime browser relevante.**

## 7. Alcançabilidade — Node / scripts / CI

Foi encontrada execução Node do SDK Firestore em testes/emuladores, por exemplo:

- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/legal-acceptance-security.test.mjs`;
- `scripts/warehouse-external-access-security.test.mjs`;
- `scripts/warehouse-modular-r1-security.test.mjs`.

Esses caminhos instanciam Firestore como **cliente** e o CI registra `GrpcConnection RPC`, comprovando que a variante Node do Firestore alcança `@grpc/grpc-js`.

Entretanto, não foi encontrado no EMPROVEX:

- import direto de `@grpc/grpc-js`;
- criação de servidor gRPC;
- `Server` do grpc-js;
- `ServerCredentials`;
- `getAuthContext`;
- `requireClientCertificate`;
- `@grpc/grpc-js-xds`;
- RBAC baseado em auth context gRPC;
- method handlers de servidor gRPC próprios.

Os caminhos administrativos/recovery inspecionados usam REST/JWT/gcloud:

- `lib/server/firebaseAuthBackup.ts`: Firestore REST + OAuth;
- `lib/server/firebaseFounderAuth.ts`: JWT/JWKS;
- `scripts/firestore-local-snapshot.mjs`: Firestore REST;
- `scripts/firestore-recovery.mjs`: gcloud.

Conclusão Node:

**a biblioteca transitiva é alcançável como cliente, mas as primitivas de servidor exigidas pelos dois advisories não são alcançáveis pelo EMPROVEX.**

## 8. Investigação de correção oficial suportada

Em 2026-10-03, a linha Firebase publicada já está muito além da versão usada pelo EMPROVEX, porém a linha Firestore atual continua declarando `@grpc/grpc-js ~1.9.0`.

Evidência pública analisada:

- Firebase `12.19.0` inclui `@firebase/firestore 4.17.2`;
- `@firebase/firestore 4.17.2` ainda possui dependência `@grpc/grpc-js ~1.9.0`;
- há issue aberta no repositório Firebase relatando exatamente que esse pin mantém `1.9.16` e que override para `1.14.x` pode instalar duas cópias, sem remover a cópia interna vulnerável.

Logo, **upgrade de Firebase 10 -> 12 não é correção para estes advisories** e adicionaria risco desnecessário de compatibilidade.

## 9. Estratégias avaliadas

### A — upgrade patch/minor suportado

**Não disponível para remover estes advisories.**

O pin `~1.9.0` impede alcançar `1.13.6` / `1.14.5`.

### B — upgrade major do Firebase

**Rejeitado.**

A linha atual do Firebase continua com o mesmo pin relevante no Firestore. Não remove o risco apontado e ampliaria superfície de regressão.

### C — override transitivo de gRPC

**Rejeitado.**

Ficaria fora do range declarado pelo Firestore e não há prova de compatibilidade oficial; além disso, há evidência de que pode coexistir com a cópia `1.9.16`.

### D — aceitação temporária documentada

**Selecionada.**

Justificativa:

1. pacote vulnerável está instalado;
2. browser não carrega o transporte Node gRPC;
3. Node usa o pacote apenas como cliente Firestore;
4. os advisories exigem primitivas de servidor não usadas pelo EMPROVEX;
5. não existe correção oficial alcançável dentro do range suportado do Firestore;
6. quebrar o contrato Firebase para zerar scanner produziria mais risco do que mitigação.

## 10. Regressão e gates

Nenhuma dependência e nenhum código runtime foram alterados na HARDEN-A2.

A baseline exata de dependências foi validada na HARDEN-A1 com:

- Application CI: **SUCCESS** — run `37114682161`;
- Core Protection: **SUCCESS** — run `37114682053`;
- Recovery guardrails: **SUCCESS** — run `37114682059`;
- Legal Validation: **SUCCESS** — run `37114682090`;
- Production Build: **PASS**;
- TypeScript final: **PASS**;
- Diff Hygiene: **PASS**;
- Firestore multi-tenant security: **PASS**;
- Central external workspace security: **PASS**;
- Auth/Drive session guards: **PASS**.

A documentação desta frente não altera esses contratos.

## 11. Firestore Rules

**SEM DELTA.**

Nenhuma Rule foi modificada, publicada ou flexibilizada.

A conclusão de segurança não depende de alteração de Rules.

## 12. Mobile R1

Classificação:

**SEM DELTA**

Motivo:

- nenhuma dependência alterada;
- nenhum Auth alterado;
- nenhum Firestore client alterado;
- nenhum workspace/UG alterado;
- nenhum contrato de sessão alterado;
- nenhum repository compartilhado alterado;
- nenhum shell/scanner alterado;
- nenhum bundle alterado.

A MOBILE-J pode reconciliar esta decisão como upstream estabilizado sem aplicar patch de Firebase.

## 13. Performance

**SEM REGRESSÃO / SEM DELTA DE BUNDLE.**

Nenhum pacote ou import foi alterado.

Não há motivo para esperar mudança em:

- Shared First Load;
- rotas críticas;
- Central;
- Mobile;
- chunks Firebase.

## 14. Risco residual

Risco residual declarado:

- scanners continuam detectando a cadeia transitiva enquanto o Firestore oficial mantiver `@grpc/grpc-js ~1.9.0`;
- se no futuro o EMPROVEX passar a operar servidor gRPC próprio com esta dependência, esta decisão deverá ser reaberta;
- se Firebase publicar Firestore com range corrigido/suportado, reavaliar a atualização;
- antes de RC/release, o Coordenador/Program Control deve aceitar conscientemente a classificação de não alcançabilidade.

Esta decisão não declara a biblioteca intrinsecamente segura. Declara apenas que **os vetores específicos conhecidos não são alcançáveis pelos usos atuais do EMPROVEX e não existe hoje correção suportada pelo Firebase que elimine o pin sem workaround fora do contrato**.

## 15. Produção

**NÃO ALTERADA**

Não houve:

- deploy;
- publicação de Rules;
- restore;
- migração;
- piloto;
- merge em `main`;
- freeze de RC.

## 16. Conclusão

A HARDEN-A2 recomenda:

**PASS — RISCO RESIDUAL ACEITO TECNICAMENTE**

Não há mudança de dependência a integrar. O artefato desta branch é a evidência auditável da decisão.

Próxima ação do Coordenador SaaS:

1. revisar a classificação de alcançabilidade;
2. confirmar aceite do risco residual antes do RC;
3. reconciliar MOBILE-R1 como **SEM DELTA**;
4. manter acompanhamento da issue upstream do Firebase sem bloquear desenvolvimento enquanto o contrato técnico permanecer o mesmo.
