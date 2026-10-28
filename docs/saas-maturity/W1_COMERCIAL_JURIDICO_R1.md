# EMPROVEX — SaaS Maturity R1 | Worker 1
## Handoff de integração — Comercial R4, Jurídico e Privacidade

> **Diretriz definitiva do fundador:** **NÃO ALTERAR FIRESTORE RULES**. O novo aceite R4 usa o servidor autenticado, preservando integralmente o aceite R1 e a política de acesso existente. Nenhum deploy Vercel ou mutação de dados foi executado durante a implementação.

### Estado e origem

- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- PR: [#402](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/402).
- Branch: `feat/saas-maturity-w1-commercial-legal-r1`.
- Base original: `86a775485d4e0761d5baed02dbb275f1a4d132a6`.
- Comercial em produção: R4, InfinitePay, cobrança por workspace e histórico de preços progressivos para novos setores; isenções/condições antigas mantidas.
- A mudança do código jurídico/aceite depende de publicação Vercel própria; não é ativada pela simples integração da branch à `main` porque o Git deploy está desabilitado.

### Entregas

| Arquivo | Finalidade |
| --- | --- |
| `app/terms/page.tsx` | Documentação de contratação por setor, trial, InfinitePay, progressão, suspensão, 48h e propriedade/recuperação gratuita dos dados próprios |
| `app/privacy/page.tsx` | Firebase/Firestore, Google Drive/Gmail, InfinitePay, dados institucionais, logs, retenção e recuperação |
| `components/billing/InfinitePayReadinessPanel.tsx` | Clareza do aceite de preços e acesso aos documentos jurídicos |
| `public/institucional/content.html` | Links jurídicos públicos no rodapé |
| `lib/legalVersions.ts` | Bundle ativo R4 e constante legada R1 para histórico |
| `lib/legalAcceptance.ts` | Escolha do aceite pelo servidor para R4, preservando transação de cliente legada |
| `app/api/legal-acceptance/route.ts` | GET e POST autenticados para aceite R4, sem alteração de Rules |
| `docs/saas-maturity/W1_COMERCIAL_JURIDICO_R1.md` | Este handoff |

### Aceite R4 sem alterar Rules

O registro R1 continua identificável pelas versões `saas-r1-2026-10-01`, `terms-2026-10-01-r1`, `privacy-2026-10-01-r1`. Os documentos antigos não são reescritos nem apagados.

O bundle R4 ativo é:

- `saas-r4-2026-10-27`
- `terms-2026-10-27-r2`
- `privacy-2026-10-27-r2`

As Rules existentes só aceitam a criação/leitura do aceite legado pelo cliente. Assim, o fluxo R4 utiliza `/api/legal-acceptance` autenticado com Firebase ID token validado criptograficamente pelo servidor. A API confere identidade, provedor, e-mail, workspace, autorização de leitura sob as Rules atuais e vínculo ao setor ou, para o fundador, ao workspace HGeSM. O token administrativo existente no backend serve apenas para recuperar ou criar o documento determinístico do usuário, **sem aceitar UID, e-mail, versão ou UG enviados pelo cliente**.

O POST requer `confirm: true` e cria o documento com precondição `exists: false` e timestamp do Firestore. O GET retorna apenas o estado do aceite do usuário validado. O fluxo é idempotente para duplicidade de cliques/abas e não concede listagem ou mutação de dados operacionais.

**As Firestore Rules ficam inteiramente intocadas.** A integração e a futura publicação devem manter o API e a constante R4 no mesmo release; não publicar apenas a troca de versão antes da rota.

### Política comercial e propriedade dos dados

- Trial de 30 dias, quando concedido.
- Progressão por mês pago, para novos contratos elegíveis: meses 1–3 R$29,90; 4–6 R$39,90; 7–9 R$49,90; 10–12 R$59,90; 13+ R$69,90.
- Pagamento via InfinitePay confirmado, não apenas checkout iniciado.
- A assinatura remunera o SaaS, não a propriedade das informações da OM. Responsável autorizado pode recuperar dados próprios sem cobrança adicional apenas pelo fornecimento; não há acesso cruzado ou promessa de exportação automática.
- Nenhum contrato histórico ou VIP foi migrado.

### Segurança e responsabilidade

- Nenhuma alteração das Rules, IAM, Firebase Authentication, preços, motor de cobrança, Warehouse, histórico de dados ou deploy.
- O aceite jurídico renovado não equivale a aceitar nova política de preços por setores legados: o gate legal e o aceite financeiro continuam separados.
- Revisão jurídica especializada sobre identificação do prestador, LGPD, retenção institucional e cancelamentos permanece recomendada, mas não é uma autorização de alteração das Rules.
- O cliente deverá solicitar o aceite R4 na primeira sessão após a publicação. Sem aceite válido, o gate deve permanecer fechado.

### Integração

Revisar diffs e executar os checks necessários. Caso não haja bloqueadores reais, integrar o PR #402 na `main` mantendo o deploy de produção existente até a publicação manual coordenada via método do Memorial Oficial. Registrar separadamente SHA da integração e ID do deployment quando houver.

**Estado deste documento:** engenharia preparada para análise final do Coordenador; nenhum deploy executado; Rules intocadas.
