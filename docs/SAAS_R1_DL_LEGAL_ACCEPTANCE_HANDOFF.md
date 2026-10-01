# SAAS-DL — Legal, Privacidade e Aceite Versionado — Handoff

Data: 2026-10-01
Status da worker: **PRONTA PARA INTEGRAÇÃO**
Branch: `saas-r1-dl-legal-acceptance`
Branch integradora: `feat/saas-r1-commercializacao`
Base comum confirmada: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`
HEAD funcional certificado: `4806adfb35d4bad29f32695ae6a9de327fe1f40d`
PR de validação/handoff: **#214 — draft**
Integração de outras workers: **nenhuma**
Deploy de produção: **não executado**

> Este documento registra implementação técnica e pesquisa de produto. Não constitui parecer jurídico e não declara o EMPROVEX juridicamente certificado ou “100% conforme” qualquer regime legal.

## 1. Escopo executado

A SAAS-DL entregou exclusivamente:

- revisão dos Termos de Serviço para o SaaS R1;
- revisão da Política de Privacidade para o contexto comercial;
- versionamento explícito dos dois documentos e do pacote legal;
- domínio de aceite por versão;
- UX isolada de aceite;
- registro Firestore tenant-scoped, create-only e idempotente;
- Rules específicas do aceite;
- testes positivos e negativos no Firestore Emulator;
- guard estrutural permanente;
- workflow focado de validação;
- documentação deste handoff.

Não foram implementados billing, pagamento, VIP, onboarding, Auth, suspensão, backup, uptime, enforcement, merge em `main` ou deploy de produção.

## 2. Versões escolhidas

Fonte única no código: `lib/legalVersions.ts`.

- `legalBundleVersion = saas-r1-2026-10-01`
- `termsVersion = terms-2026-10-01-r1`
- `privacyVersion = privacy-2026-10-01-r1`
- `schemaVersion = emprovex_legal_acceptance_v1`

As páginas públicas exibem sua versão atual.

### Regra para uma futura versão

Uma alteração que exija novo aceite deve, na mesma entrega controlada:

1. criar novo `legalBundleVersion`;
2. alterar `termsVersion` e/ou `privacyVersion` conforme o documento modificado;
3. atualizar os valores esperados nas Rules;
4. executar o guard e o Firestore Emulator;
5. integrar o gate no shell já resolvido pelo Coordenador/SAAS-I;
6. nunca alterar o registro histórico anterior.

O ID determinístico muda com `legalBundleVersion`, portanto uma nova versão produz um novo registro em vez de sobrescrever o aceite anterior.

## 3. Schema e caminho Firestore

Banco: **Firestore principal do EMPROVEX**.

Nenhum terceiro banco foi criado.
`emprovex-warehouse` não foi utilizado.

Caminho:

```text
workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}
```

Schema atual:

```text
schemaVersion
workspaceId
ug
uid
email
legalBundleVersion
termsVersion
privacyVersion
acceptedAt
```

Sem cópia de dados operacionais.

`acceptedAt` é enviado com `serverTimestamp()` e as Rules exigem equivalência a `request.time`. Timestamp arbitrário do cliente é rejeitado.

## 4. Comportamento do domínio

Arquivos principais:

- `lib/legalVersions.ts`;
- `lib/legalAcceptance.ts`;
- `hooks/useLegalAcceptance.ts`;
- `components/legal/LegalAcceptanceGate.tsx`.

O runtime:

1. resolve a identidade já autenticada e o workspace já autorizado;
2. faz `get` direto somente no documento determinístico da versão vigente;
3. se o documento não existir, retorna estado `required`;
4. apresenta Termos e Privacidade antes do aceite;
5. registra o aceite em transação;
6. se o mesmo documento já existir e corresponder ao pacote vigente, retorna idempotentemente sem nova gravação;
7. depois do aceite, retorna estado `accepted`.

Não há query/listagem de histórico no caminho normal.

A consulta do primeiro uso foi testada explicitamente: o usuário pode consultar o seu documento vigente ainda inexistente e receber `exists=false`, sem receber `permission-denied`.

## 5. UX de aceite

Texto utilizado:

> “Li e aceito os Termos de Serviço e a Política de Privacidade.”

A tela:

- permite abrir `/terms` antes de aceitar;
- permite abrir `/privacy` antes de aceitar;
- não chama o aceite contratual de “consentimento LGPD”;
- informa que o aceite dos documentos não significa que todo tratamento de dados dependa de consentimento;
- não solicita novamente a mesma versão;
- falha fechada se não conseguir verificar o estado do aceite.

O componente foi mantido **isolado** e não foi conectado ao shell/login nesta worker.

## 6. Ponto de integração com SAAS-C / SAAS-I

A integração deve ocorrer somente depois que Auth + workspace context já estiverem resolvidos.

Entrada necessária para `LegalAcceptanceGate`:

```ts
{
  workspaceId: string;
  uid: string;
  email: string;
  ug?: string | null;
}
```

Recomendação de glue:

- aplicar o gate ao shell operacional de `sector`;
- não colocar o gate nas rotas públicas `/terms` e `/privacy`;
- não bloquear recuperação de credenciais ou superfícies públicas necessárias;
- não fazer o gate depender de billing;
- VIP/isento passa pelo mesmo gate legal que usuário pagante;
- evitar duplicar a resolução de workspace já feita por SAAS-C;
- preservar o estado `checking` antes de liberar dados operacionais.

Esse glue pertence ao Coordenador/SAAS-I para evitar conflito de arquivos com SAAS-C.

## 7. Rules e segurança

A coleção `legalAcceptances` possui Rules dedicadas.

### Leitura

O tenant pode fazer somente `get` do documento:

```text
{request.auth.uid}__saas-r1-2026-10-01
```

dentro do próprio workspace autorizado.

`list` é negado.

### Criação

A criação exige simultaneamente:

- `canAccessWorkspace(workspaceId)`;
- workspace do caminho igual ao payload;
- UID igual a `request.auth.uid`;
- e-mail igual ao token autenticado;
- e-mail igual ao `authorizedEmail` do workspace;
- UG coerente com o workspace;
- schema esperado;
- `legalBundleVersion` esperado;
- `termsVersion` esperado;
- `privacyVersion` esperado;
- ID determinístico correto;
- `acceptedAt == request.time`;
- apenas os campos previstos no schema.

### Imutabilidade

- `update`: negado;
- `delete`: negado;
- usuário não lista histórico;
- não há bypass de admin/founder nas Rules dessa coleção.

Uma eventual auditoria administrativa extraordinária pode ser feita por backend/Admin SDK autorizado, sem abrir leitura cross-tenant ao cliente.

## 8. Termos de Serviço alterados

`app/terms/page.tsx` foi atualizado para cobrir, em linguagem direta:

- EMPROVEX como serviço;
- Plano Completo;
- trial padrão de 30 dias;
- cobrança externa;
- Mercado Pago quando utilizado;
- Pix;
- ausência de processamento direto de cartão pelo EMPROVEX no modelo R1;
- suspensão administrativa;
- reativação;
- cancelamento separado de exclusão;
- preservação de dados;
- responsabilidade do usuário pelos dados inseridos;
- integrações Google;
- Firebase/Google Cloud, Vercel e serviços de terceiros;
- manutenção e indisponibilidade sem promessa absoluta;
- documentos como apoio e responsabilidade de conferência;
- alteração/versionamento dos Termos;
- legislação brasileira;
- canal de suporte.

Não foi incluída promessa de disponibilidade absoluta nem declaração de certificação jurídica.

## 9. Política de Privacidade alterada

`app/privacy/page.tsx` foi atualizada para cobrir:

- usuários externos e identidade/workspace/UG;
- dados operacionais;
- dados administrativos de billing;
- logs, auditoria e telemetria;
- backup e recuperação;
- Firebase/Google Cloud;
- Vercel;
- Google Drive;
- Gmail;
- Mercado Pago quando utilizado;
- Pix/pagamento externo;
- retenção por finalidade e obrigações aplicáveis;
- cancelamento separado de exclusão;
- direitos e solicitações do titular;
- contato;
- Google API Services User Data Policy / Limited Use.

O texto deixa explícito que, no modelo R1, o EMPROVEX não precisa armazenar número de cartão, CVV, senha ou token secreto de pagamento.

A política não afirma que toda base legal é consentimento e não afirma “100% conforme LGPD”.

## 10. Fontes oficiais consultadas

Consulta realizada em 2026-10-01. Foram utilizadas apenas fontes oficiais/primárias para confirmar requisitos atuais relevantes.

1. Presidência da República — Lei nº 13.709/2018 (LGPD):
   https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm

2. ANPD — Direitos dos Titulares:
   https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares

3. ANPD — Resolução CD/ANPD nº 2/2022, agentes de tratamento de pequeno porte:
   https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022

4. Google for Developers — Google Workspace User Data and Developer Policy:
   https://developers.google.com/workspace/workspace-api-user-data-developer-policy

5. Firebase — Privacy and Security in Firebase:
   https://firebase.google.com/support/privacy/

6. Vercel — Privacy Notice:
   https://vercel.com/legal/privacy-notice

7. Mercado Pago — Centro/Declaração de Privacidade:
   https://www.mercadopago.com.br/privacidade

8. Mercado Pago Developers — soluções com e sem integração, incluindo link de pagamento:
   https://www.mercadopago.com.br/developers/pt/docs/getting-started

### Consequências técnicas adotadas a partir da consulta

- não tratar aceite contratual como base legal genérica de todo tratamento;
- manter informações de finalidade, contato e direitos do titular;
- não presumir enquadramento do EMPROVEX como agente de pequeno porte;
- manter transparência das integrações Google e Limited Use;
- tratar Mercado Pago como provedor externo quando o fluxo ocorrer fora do EMPROVEX;
- não inventar retenções fixas sem base operacional/legal definida.

## 11. Testes e certificação técnica da worker

HEAD funcional certificado: `4806adfb35d4bad29f32695ae6a9de327fe1f40d`.

Workflow focado:

- **SAAS-DL Legal Validation**
- run: `36938091937`
- conclusão: **SUCCESS**

Gates verdes:

- `npm run typecheck`;
- `npm run verify:public-oauth-legal-pages`;
- `npm run verify:saas-r1-legal-acceptance`;
- `npm run test:saas-r1-legal-acceptance` com Auth + Firestore Emulator;
- `npm run verify:emprovex-core-protection`;
- `npm run build`;
- `git diff --check`.

O build de produção compilou com sucesso em Next.js 15.5.24.

### Cenários do Firestore Emulator

PASS:

- primeiro uso consulta documento vigente inexistente;
- usuário aceita versão atual;
- usuário lê seu próprio aceite;
- mesma versão é idempotente e não cria novo registro;
- outro workspace não lê aceite alheio;
- outro workspace não grava aceite alheio;
- usuário não altera aceite;
- usuário não apaga aceite;
- usuário não lista histórico;
- UID divergente é rejeitado;
- e-mail divergente é rejeitado;
- UG divergente é rejeitada;
- versão diferente não reutiliza o documento vigente;
- timestamp arbitrário do cliente é rejeitado.

Também passaram, em workflows globais do PR durante a execução, Core Protection e Recovery guardrails.

## 12. Commits funcionais relevantes

- `0fa869b5` — pacote legal versionado;
- `40b172fe` — domínio de aceite imutável/idempotente;
- `7f6a1063` — hook do pacote vigente;
- `0132e13c` — gate isolado de aceite;
- `8e5f2914` — versão visível em páginas públicas;
- `67aef1c1` — Termos SaaS R1;
- `46567e9d` — Privacidade SaaS R1;
- `06129bbd` — Rules iniciais do aceite;
- `6dad8ea4` — testes de segurança;
- `ad3569b9` — guard SAAS-DL;
- `63c36f3e` — scripts npm;
- `69447ca3` — workflow focado;
- `91caaf8e` — compatibilidade do contrato OAuth/legal existente;
- `5a929488` — guard independente de quebra de linha JSX;
- `63b6f8bd` — leitura segura no primeiro uso;
- `ebb19a42` — teste explícito de aceite inexistente;
- `4806adfb` — guard do contrato de leitura vigente.

## 13. Riscos jurídicos que exigem avaliação humana

Antes da abertura comercial ampla, ainda deve existir revisão humana qualificada sobre:

- identificação jurídica exata de quem oferece/contrata o serviço e dados cadastrais que devam constar nos documentos;
- definição de papéis concretos de controlador/operador conforme cada relacionamento e cliente;
- obrigações fiscais, consumeristas, contratuais e contábeis da comercialização;
- política de retenção por categoria documental quando houver requisitos institucionais ou legais específicos;
- eventual necessidade/forma de encarregado ou canal formal, sem presumir automaticamente o regime simplificado da Resolução CD/ANPD nº 2/2022;
- transferências internacionais/suboperadores e instrumentos contratuais aplicáveis, quando pertinente;
- procedimento operacional definitivo para solicitações de titulares e incidentes.

Esses pontos não foram automatizados nem apresentados como resolvidos juridicamente.

## 14. Itens deliberadamente não automatizados

- aceite não é conectado ao shell/login nesta worker;
- não existe auto-suspensão;
- não existe exclusão automática de dados por cancelamento;
- não existe integração API/webhook com Mercado Pago;
- não existe armazenamento de credencial secreta de pagamento;
- não existe mecanismo genérico de “consentimento LGPD”;
- não existe bypass de cliente para admin ler todos os aceites;
- não existe merge/deploy de produção;
- não existe declaração de certificação jurídica.

## 15. Integração esperada

O Coordenador deve:

1. revisar o PR draft #214;
2. integrar semanticamente SAAS-DL na branch `feat/saas-r1-commercializacao`;
3. resolver qualquer conflito de `package.json`, CI ou Rules com outras workers sem usar `ours/theirs` global;
4. conectar `LegalAcceptanceGate` ao shell somente depois de SAAS-C estar semanticamente estável;
5. reexecutar gates de legal + onboarding + segurança após o glue;
6. atualizar `SAAS_R1_INTEGRATION_STATUS.md`, `SAAS_R1_COORDENADOR_HANDOFF.md` e o Memorial Oficial;
7. somente depois decidir sobre merge/deploy conforme o plano coordenado.

---

**SAAS-DL — PRONTA PARA INTEGRAÇÃO**
