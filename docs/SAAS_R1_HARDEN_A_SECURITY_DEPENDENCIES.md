# EMPROVEX SaaS R1 — HARDEN-A — Segurança e Dependências

Data: **2026-10-03**

Branch: `saas-harden-a-security-dependencies`
Base congelada: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`
Integradora-alvo: `feat/saas-r1-commercializacao`
Status técnico da frente: **PARCIAL — correções não-breaking concluídas; decisões de major upgrade pendentes**

## 1. Escopo e governança

A HARDEN-A foi executada sobre a base congelada correta, sem rebase, merge ou cherry-pick da integradora e sem incorporar HARDEN-B/C/D.

A documentação pós-freeze da integradora foi consultada somente em leitura. A CT-01 / `Permissions-Policy` da câmera não pertence a esta frente e não foi alterada.

Não foi executado `npm audit fix --force`.

## 2. Método

A auditoria foi reproduzida em runner Linux/Node 20 com:

- `npm ci`;
- `npm audit --json`;
- `npm ls <pacote>`;
- `npm explain <pacote>`;
- simulação segura de `npm audit fix --package-lock-only`, sem `--force`;
- inspeção de alcance no código para Firebase, jsPDF e PostCSS/Next;
- TypeScript;
- Production Build;
- Core Protection;
- Recovery tests;
- Legal Validation;
- `git diff --check`.

O runner temporário usado para capturar evidência foi removido antes do PR; os runs permanecem no histórico do GitHub Actions.

## 3. Baseline real reproduzido

O valor histórico foi confirmado, não presumido.

| Severidade | Antes |
|---|---:|
| Critical | 1 |
| High | 17 |
| Moderate | 4 |
| Low | 0 |
| Total | **22** |

Metadados do audit inicial: 547 dependências totais, sendo 121 prod, 376 dev e 106 optional.

Evidência principal: GitHub Actions run `37096733506`.

## 4. Correção mínima não-breaking aplicada

A simulação de `npm audit fix --package-lock-only`, sem `--force`, demonstrou que oito vulnerabilidades de pacote podiam ser removidas apenas com atualização compatível do lockfile.

A mesma alteração foi então aplicada ao `package-lock.json`, sem alterar `package.json`.

Principais versões atualizadas:

| Pacote | Antes | Depois |
|---|---:|---:|
| @emnapi/runtime | 1.11.1 | 1.11.3 |
| @next/eslint-plugin-next | 15.5.25 | 15.5.27 |
| eslint-config-next | 15.5.25 | 15.5.27 |
| baseline-browser-mapping | 2.10.40 | 2.11.27 |
| brace-expansion | 1.1.15 | 1.1.21 |
| browserslist | 4.28.4 | 4.29.3 |
| js-yaml | 4.3.0 | 4.3.2 |
| nanoid | 3.3.15 | 3.3.19 |
| postcss (top-level/dev) | 8.5.16 | 8.5.28 |
| protobufjs | 7.6.4 | 7.6.6 |
| sharp | 0.34.5 | 0.35.5 |
| tar | 7.5.19 | 7.5.22 |
| update-browserslist-db | 1.2.3 | 1.3.3 |

Também foram atualizados os pacotes opcionais `@img/sharp-*` / libvips compatíveis com `sharp@0.35.5`, além de dados de browsers suportados (`caniuse-lite`, `electron-to-chromium`, `node-releases`).

Vulnerabilidades eliminadas nessa etapa:

- `baseline-browser-mapping` — GHSA-w5vr-8v7q-w6rv;
- `brace-expansion` — GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895, GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7 e GHSA-6j4f-fj2g-mc7p;
- `browserslist` — GHSA-c83g-rgw3-j3cx e GHSA-73wf-gq98-2v4g;
- `js-yaml` — GHSA-5p4m-2wfm-xmqj e GHSA-2883-xcg3-v3hh;
- `nanoid` — GHSA-28wg-ghj8-5hjv e GHSA-2v37-7h3g-55p8;
- `protobufjs` — GHSA-j3f2-48v5-ccww;
- `sharp` — GHSA-f88m-g3jw-g9cj e GHSA-rgj7-g3m4-5g8c;
- `tar` — GHSA-r292-9mhp-454m.

Após a correção segura:

| Severidade | Depois |
|---|---:|
| Critical | 1 |
| High | 11 |
| Moderate | 2 |
| Low | 0 |
| Total | **14** |

Uma nova simulação segura no lockfile corrigido não produziu delta adicional. Evidência: runs `37096933781`, `37097201877` e `37097424649`.

## 5. Advisories restantes — classificação por cadeia

### 5.1 Firebase → Firestore → @grpc/grpc-js

Pacotes contabilizados pelo npm audit: 4 HIGH:

- `firebase@10.14.1` — dependência direta de produção;
- `@firebase/firestore@4.7.3`;
- `@firebase/firestore-compat@0.3.38`;
- `@grpc/grpc-js@1.9.16`.

Cadeia comprovada por `npm ls` / `npm explain`:

`firebase -> @firebase/firestore -> @grpc/grpc-js`

Advisories raiz do gRPC:

- GHSA-m9gg-hp2v-232j — HIGH — validação de certificados em determinadas configurações de `getAuthContext`;
- GHSA-f596-whhp-79r4 — LOW — exposição de determinadas mensagens de erro do handler.

Alcançabilidade observada:

- Firebase/Firestore é efetivamente usado pelo runtime do EMPROVEX;
- o código da aplicação importa `firebase/firestore` diretamente;
- não foi encontrado uso direto de `@grpc/grpc-js` pelo EMPROVEX;
- rotas administrativas inspecionadas usam REST/JWT para operações server-side, não uma API gRPC própria;
- portanto o componente vulnerável é **transitivo de produção**, com precondições de exploração não reproduzidas no uso operacional observado.

Correção indicada pelo npm: instalação breaking de `firebase@9.14.0`, o que seria um downgrade de linha principal e não é uma correção aceitável automática.

**Decisão HARDEN-A: `REQUER COORDENADOR`.**

Não aplicar `--force`, override não suportado ou troca de linha do Firebase sem uma frente controlada de compatibilidade.

### 5.2 ESLint/Next tooling → fast-glob → micromatch → braces

Pacotes contabilizados: 5 HIGH:

- `eslint-config-next@15.5.27`;
- `@next/eslint-plugin-next@15.5.27`;
- `fast-glob@3.3.1`;
- `micromatch@4.0.8`;
- `braces@3.0.3`.

Cadeia comprovada:

`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`

Advisory raiz:

- GHSA-vfj7-8cjw-p6xm — HIGH — stack exhaustion por padrões profundamente aninhados.

Todos os pacotes dessa cadeia estão marcados como **dev** no lockfile. Não participam do runtime publicado nem recebem padrões de glob de usuários do EMPROVEX.

O npm propõe como “fix” uma mudança breaking para `eslint-config-next@14.2.35`, que seria regressiva em relação à linha atual.

**Decisão HARDEN-A: `DEV-ONLY / NÃO ALCANÇÁVEL NO RUNTIME` — ACEITAR COM EVIDÊNCIA.**

### 5.3 jsPDF → DOMPurify / jsPDF-AutoTable

Pacotes contabilizados:

- `jspdf@2.5.2` — **CRITICAL**, direto, produção;
- `jspdf-autotable@3.8.4` — HIGH, direto, produção;
- `dompurify@2.5.9` — MODERATE, transitivo/optional de jsPDF.

Uso real confirmado no EMPROVEX:

- `lib/pdfToolkit.ts` carrega jsPDF/autotable sob demanda;
- Cronogramas cria PDFs com `new jsPDF()`, `autoTable`, `output()` e `save()`;
- Relatórios usa `new jsPDF()`, `autoTable`, `output()` e `save()`;
- Central de Depósitos usa jsPDF em folha de alocação, documentos de saída e etiquetas.

Na inspeção dos pontos de uso não foram encontrados os vetores específicos `addJS`, AcroForm, `.html()`, `loadFile`, `addFileToVFS` ou saída `dataurlnewwindow`. Isso reduz a alcançabilidade de parte dos advisories, mas **não transforma uma dependência direta CRITICAL em aceitável automaticamente**.

Advisories jsPDF registrados pelo audit:

- GHSA-w532-jxjh-hjhj — ReDoS;
- GHSA-8mvj-3j78-4qmw — DoS;
- GHSA-f8cm-6447-x5h2 — CRITICAL — Local File Inclusion/Path Traversal;
- GHSA-pqxr-3g65-p328 — HIGH — PDF injection em AcroFormChoiceField;
- GHSA-95fx-jjr5-f39c — HIGH — DoS por dimensões BMP;
- GHSA-vm32-vv63-w422 — MODERATE — XMP metadata injection;
- GHSA-cjw8-79x6-5cj4 — MODERATE — race condition no plugin addJS;
- GHSA-9vjf-qc39-jprp — HIGH — PDF object injection via addJS;
- GHSA-67pg-wm7f-q7fj — HIGH — DoS por dimensões GIF;
- GHSA-p5xg-68wr-hm3m — HIGH — PDF injection em AcroForm;
- GHSA-7x6v-j9x4-qf24 — HIGH — PDF object injection via FreeText;
- GHSA-wfv2-pwc8-crg5 — CRITICAL — HTML injection em caminhos de New Window.

Advisories DOMPurify registrados pelo audit:

- GHSA-vhxf-7vqr-mrjg;
- GHSA-h7mw-gpvr-xq4m;
- GHSA-crv5-9vww-q3g8;
- GHSA-hpcv-96wg-7vj8;
- GHSA-r47g-fvhr-h676;
- GHSA-rp9w-3fw7-7cwq;
- GHSA-cmwh-pvxp-8882;
- GHSA-vxr8-fq34-vvx9;
- GHSA-x4vx-rjvf-j5p4;
- GHSA-76mc-f452-cxcm;
- GHSA-39q2-94rc-95cp;
- GHSA-cjmm-f4jc-qw8r;
- GHSA-cj63-jhhr-wcxv;
- GHSA-h8r8-wccr-v5f2;
- GHSA-55q2-fjhq-7xh7;
- GHSA-c2j3-45gr-mqc4.

Correção indicada pelo npm:

- `jspdf@4.2.1` — breaking/major;
- `jspdf-autotable@5.0.8` — breaking/major.

**Decisão HARDEN-A: `REQUER COORDENADOR` — principal pendência antes de declarar PASS.**

Recomendação: autorizar uma frente curta e controlada para upgrade conjunto de jsPDF/jsPDF-AutoTable, com regressão visual/funcional dos PDFs de Cronograma, Relatórios e Central antes do freeze do RC.

### 5.4 Next.js → PostCSS embutido

Pacotes contabilizados:

- `next@15.5.24` — MODERATE no agregado;
- `next/node_modules/postcss@8.4.31` — HIGH.

O `postcss` top-level/dev foi corrigido para 8.5.28; o achado restante é a versão embutida/pinada pelo Next 15.5.24.

Advisories raiz:

- GHSA-qx2v-qp2m-jg93 — XSS em stringify de CSS;
- GHSA-6g55-p6wh-862q — HIGH — leitura arbitrária por `sourceMappingURL`;
- GHSA-fxqj-rqcc-2cmp — incomplete fix / leitura de .map;
- GHSA-r28c-9q8g-f849 — HIGH — path traversal em source map.

No EMPROVEX, PostCSS é ferramenta de transformação de CSS do build. Não existe fluxo operacional identificado que aceite CSS/source map arbitrário fornecido por usuário e o entregue a esse pipeline.

O npm propõe `next@16.3.8`, major upgrade, fora da autorização automática desta frente.

**Decisão HARDEN-A: `NÃO ALCANÇÁVEL NO RUNTIME OPERACIONAL / ACEITAR COM EVIDÊNCIA`.**

A atualização major do Next deve ocorrer em janela própria, não como efeito colateral de hardening.

## 6. Matriz resumida de decisão

| Cadeia | Severidade npm | Runtime/dev | Alcançabilidade | Decisão |
|---|---|---|---|---|
| Firebase / Firestore / gRPC | 4 HIGH | produção | Firestore alcançável; gRPC transitivo, sem chamada direta observada | **REQUER COORDENADOR** |
| ESLint / glob / braces | 5 HIGH | dev-only | não alcançável no runtime | **ACEITAR COM EVIDÊNCIA** |
| jsPDF / DOMPurify / AutoTable | 1 CRITICAL + 1 HIGH + 1 MODERATE | produção | jsPDF diretamente alcançável; vetores específicos perigosos não observados | **REQUER COORDENADOR** |
| Next / PostCSS embutido | 1 HIGH + 1 MODERATE | build/runtime package | vetor depende de CSS/source map não confiável; fluxo não existe no produto | **ACEITAR COM EVIDÊNCIA** |

## 7. Gates e regressão

Runs de evidência HARDEN-A:

- `37096733506` — baseline 22 + TypeScript + Core Protection + Recovery + Legal + Build + Diff Hygiene: SUCCESS;
- `37096933781` — simulação segura de correção e classificação: SUCCESS;
- `37097201877` — lockfile corrigido, audit 14, sem novo safe fix, TypeScript/Core/Recovery/Legal/Build/Diff: SUCCESS;
- `37097424649` — `npm ls` / `npm explain` canônicos para as cadeias e gates: SUCCESS;
- `37097554883` — cobertura final de `postcss`, audit estável em 14 e todos os gates: SUCCESS.

Resultados confirmados após a correção:

- `npm ci`: PASS;
- TypeScript: PASS;
- Production Build: PASS;
- EMPROVEX Core Protection: PASS;
- Recovery tests: 7/7 PASS;
- SaaS R1 Legal Acceptance guard: PASS;
- `git diff --check`: PASS;
- nova simulação `npm audit fix --package-lock-only`: nenhum delta adicional seguro.

Não foi observada regressão funcional ou de build decorrente das atualizações compatíveis do lockfile.

## 8. Impacto MOBILE-R1

Classificação: **DELTA COMPATÍVEL**.

Motivo:

- existe delta compartilhado de `package-lock.json`;
- não houve alteração de API, contrato Firestore, Auth, billing, lifecycle, UI móvel ou código compartilhado de domínio;
- não houve upgrade major;
- a reconciliação Mobile deve preservar esse lockfile atualizado e reexecutar `npm ci`/build/gates após integração.

Nenhuma tentativa de resolver colisão cruzando branches foi realizada.

## 9. Arquivos finais pretendidos da HARDEN-A

- `package-lock.json`;
- `docs/SAAS_R1_HARDEN_A_SECURITY_DEPENDENCIES.md`.

O workflow temporário de auditoria foi removido antes do PR e não faz parte do delta final pretendido.

## 10. O que não foi executado

- nenhum `npm audit fix --force`;
- nenhum major upgrade;
- nenhum rebase;
- nenhum merge da integradora;
- nenhum merge em `main`;
- nenhum deploy;
- nenhuma promoção Vercel;
- nenhuma publicação de Rules;
- nenhum restore;
- nenhuma alteração de usuário/workspace real;
- nenhum piloto;
- nenhum freeze de RC;
- nenhuma CT-01 / alteração de `next.config.ts`.

## 11. Conclusão

A superfície de dependências melhorou de **22** para **14** vulnerabilidades de pacote sem breaking change e sem regressão detectada.

A HARDEN-A não pode declarar PASS unilateralmente porque permanece uma dependência direta de runtime classificada como **CRITICAL** (`jspdf@2.5.2`) cuja correção exige major upgrade, além da cadeia Firebase/gRPC cuja solução indicada pelo npm também é breaking e inadequada para aplicação automática.

**Status: PARCIAL.**

### Recomendação ao Coordenador SaaS

1. Autorizar uma correção controlada de `jspdf` + `jspdf-autotable` antes do freeze do Release Candidate, com regressão específica dos documentos PDF.
2. Tratar a cadeia Firebase/gRPC em decisão separada: não aceitar downgrade forçado; validar a versão suportada do Firebase que elimina o gRPC vulnerável e testar Auth/Firestore/Central.
3. Manter os achados dev-only e Next/PostCSS como riscos documentados até uma atualização coordenada, salvo mudança de alcançabilidade.
4. Após qualquer major upgrade aprovado, repetir todo o audit e os gates da HARDEN-A.

### Recomendação ao Coordenador Geral

Registrar **DELTA COMPATÍVEL** para MOBILE-R1. Não há conflito funcional cruzado conhecido, mas o lockfile atualizado deve ser preservado e revalidado no ponto de reconciliação.
