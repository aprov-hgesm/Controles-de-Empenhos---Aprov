# EMPROVEX Suporte R1 — Handoff técnico do Worker W2

**Data:** 31/10/2026 (Brasília)  
**Status:** EM PR DRAFT — sem merge e sem produção  
**Branch:** `feat/emprovex-suporte-r1-w2-relacionamento`  
**PR:** [#443](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/443)  
**Base técnica inicial:** `main@35825d5ad563361fecd1b3d2a00ca81a4734e532`  
**Memorial canônico:** `docs/EMPROVEX_SUPORTE_ONBOARDING_MEMORIAL_OFICIAL.md`, PR #440  
**Diretriz:** GOV-SIMP-01.

## 1. Auditoria prévia e decisões

- **A-05 confirmado:** painel Interessados possuía só status, contatos e filtro local. Decisão: última interação humana, próxima ação e nota curta; nenhum ticket/CRM.
- **A-06 confirmado:** `GET /api/admin/access-requests` aplicava `pageSize=100` sem cursor. Decisão: paginação Firestore server-side de 25 registros/consulta, `orderBy=createdAt desc`, cursor opaco `nextPageToken` e navegação anterior/próxima. Busca textual é **limitada à página carregada** e assim rotulada, sem varredura geral de PII.
- **A-07 confirmado:** POST repetido retornava sucesso após `409`, sem novo sinal. Decisão: preservar documento SHA-256(e-mail), `createdAt`, status e informações registradas pelo Admin; marcar somente `lastRequestedAt` após 24h mediante leitura pontual + PATCH com `currentDocument.updateTime`. Falhas/concorrência geram resposta pública neutra.
- **A-08 confirmado:** rota de acesso não dispara avisos; o painel agora exibe aviso de recontato/retorno, sem e-mails automáticos.
- **A-09 confirmado:** `em_teste` é status administrativo, não prova de trial; nenhuma associação automática por e-mail ao workspace, nem consulta à cobrança.

## 2. Fluxos — antes e depois

**Antes:** formulário institucional → documento deduplicado → painel com primeiros 100 leads e filtro local → alteração de situação. Reenvios não eram visíveis.

**Depois:** formulário permanece idêntico → primeiro pedido cria mesmo documento, agora com `lastRequestedAt` → reenvio elegível atualiza somente marcador → Admin percorre páginas de 25 interessados; vê necessidade de atenção e registra `lastContactAt`, `nextActionAt` e `adminNote`; status continua com 5 valores. Sem integração com trial ou workspace.

## 3. Arquivos deste Worker

- `components/admin/AdminAccessRequestsPanel.tsx`: acompanhamento, indicadores restritos à página, busca explícita local, navegação por cursor.
- `app/api/admin/access-requests/route.ts`: GET fundador-only paginado; PATCH de campos autorizados com validação de 4 KiB e CAS por `updateTime`.
- `app/api/public/access-requests/route.ts`: criação idempotente e marcação best-effort do reenvio.
- `lib/server/accessRequestSupport.ts`: mapeamento, validações, consulta paginada e limite de gravação de repetição.
- `scripts/emprovex-support-w2.test.mjs`: testes sintéticos dirigidos do contrato.

**Arquivos reservados não alterados:** `PlatformAdminView.tsx`, login, sidebar, `firestore.rules`, provisionamento, Auth, billing/InfinitePay, Cloud Run, Empresas e Almoxarifado.

## 4. Persistência e compatibilidade

Coleção **existente** `platformAccessRequests`. Nenhuma nova coleção, migração ou índice manual obrigatório solicitado.

| Campo | Tipo no Firestore | Semântica |
| --- | --- | --- |
| `lastRequestedAt` | timestamp | Momento do pedido original ou última repetição persistida; no legado pode estar ausente |
| `lastContactAt` | string `YYYY-MM-DD` | Data preenchida pelo fundador; vazia se ausente |
| `nextActionAt` | string `YYYY-MM-DD` | Próxima ação humana opcional |
| `adminNote` | string, até 280 chars | Nota administrativa curta, não destinada a documentos operacionais |
| `updatedAt` | timestamp | Atualização administrativa; reenvio não modifica esta data |
| `status` | valores vigentes | Preservado no reenvio |
| `createdAt` | timestamp | Preservado integralmente |

Registros legados sem novos campos são lidos como strings vazias. Todos os novos campos são opcionais. O vínculo de lead com workspace/trial permanece **não implementado** intencionalmente.

## 5. Custos, segurança e privacidade

- GET administrativo: até **25 documentos/página** sem listener e com cursor Firestore; não realiza busca global nem carga infinita do browser.
- Reenvio após POST existente (`409`): uma leitura pontual do documento; no máximo uma gravação elegível por intervalo de 24h **por e-mail**, protegida por comparação de versão; requisições repetidas continuam incorrendo no POST de conflito e na leitura, sujeitas ao limitador best-effort já existente por instância.
- PATCH administrativo: uma gravação por salvamento; não amplia escopo para outros workspaces nem aceita `workspaceId`, IDs não SHA-256 ou campos arbitrários.
- A validação continua vinculada a `verifyFounderFirebaseRequest`, sem expor leads ao público. Resposta de reenvio permanece neutra e não enumera contas.
- Persistência de contato tem finalidade comercial/administrativa; retenção e política de privacidade devem ser revistas por W4 antes da publicação, se necessário. Campo de nota limita tamanho e avisa sobre informações proibidas; texto livre não garante que pessoas não digitem dados inadequados.

## 6. Testes e homologação

Teste adicionado, executável em Node 24 por:

```bash
node --experimental-strip-types --test scripts/emprovex-support-w2.test.mjs
```

Coberturas sintéticas implementadas: status, CAS, validação de campos, página >100, custo de paginação, reenvio em menos/acima de 24h, conflito 412, e inspeção estática de guard fundador e resposta neutra. As provas de não regressão de provisionamento decorrem do diff restrito; **não substituem teste integrado de ambiente real**.

**Evidência de validação adicional:** 8 verificações comportamentais **PASS** (status/CAS, nota limitada, data inválida, rejeição de workspaceId, token, paginação 127 registros/6 chamadas, recontato elegível, reenvio <24h). Foi executado o código de `lib/server/accessRequestSupport.ts` da branch em ambiente JavaScript isolado com somente anotações de tipos TypeScript removidas e HTTP simulado. **Não equivale à execução do arquivo Node de testes, à integração Next/Firebase ou a teste com clientes.**

**CI verificado:** Fast CI do commit `5286368e41a679dc297fb6b56f33b04e85620cfa` concluiu **SUCCESS**, incluindo TypeScript sem erros, sintaxe JS e suites selecionadas; o arquivo W2 foi marcado como sintaticamente válido, mas **não foi executado como suíte funcional dedicada** nessa pipeline. Alteração posterior na normalização do texto `bdaa05f20cb4d7579297332e89f7da2c53d619f4` deverá ser acompanhada pelos checks próprios. Application CI da PR DRAFT não constitui certificação completa.

## 7. Pendências e parecer

- W4: revisar comportamento de apresentação no Admin e combinar interfaces com demais Workers, sem sobrescrever alterações paralelas.
- Validar em CI o TypeScript e executar o teste W2; testar com emulador se houver alteração futura de autorização/persistência.
- Confirmar política de retenção das notas administrativas antes de produção; não ampliar coleta.
- Não inferir trial concedido, provisionamento ou abandono por status ou e-mail.
- **Parecer inicial:** GO CONDICIONAL apenas para revisão de integração técnica W4; NO-GO para merge e produção até testes dirigidos e certificação de integração.

## 8. Referências para o integrador

- PR W2 #443; branch e commits da própria PR são a fonte do SHA final.
- PR documental #440 (memorial); **não editar suas seções concorrentes a partir da branch W2**.
- Não criar migração Firestore, vincular lead a workspace automaticamente ou mudar regras de billing para executar esta frente.
