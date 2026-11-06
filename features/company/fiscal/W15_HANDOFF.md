# W15 — EMPROVEX Empresas | Portal fiscal e QA multi-CNPJ
**Data:** 06/11/2026 • **Worker W15** • **Branch:** feat/empresas-w15-fiscal-ux-qa-20261106
**Status:** implementação isolada para revisão técnica, **sem integração de menu/rota, merge, deploy ou emissão fiscal real**.

## Base e ownership
- Memorial Oficial da PR #510 e plano W12–W15; W10-I PR #520 @ 46af306ea67e2c5d45f8a2af922ef2781e154212.
- Base operacional atual W10-III PR #527 @ d9aa77a5e0c27b77582ecf6742a3358a509e8abb, descendente de W10-II #525. Includes W12 #521, W13 #522 e W14 #526 sem duplicar código.
- Lidos contratos W14 de NF-e (index.d.mts), handoff W14, W10-III e switcher W12.
- Escritas exclusivas: features/company/fiscal/**, components/company/fiscal/**, tests/company/fiscal/**, este handoff e workflow W15 isolado; workflow W10/global, app/empresa, módulo W4, sesssão W0/W10, Rules e motor W12–W14 inalterados.

## Implementado (código funcional limitado ao ambiente QA)
1. Componente React responsivo e acessível FiscalIssuanceWorkspace: emitente e CNPJ do perfil ativo validado; troca de perfil reaproveitando W12; resumo sanitizado da conexão WLG; ambiente HOMOLOGAÇÃO visível; formulário de intenção, destinatário, item, classificações fiscais, prévia e revisão humana; botão de envio condicionado ao backend; consulta/status limitado ao CNPJ; orientação para XML/DANFE privados e eventos fiscais ainda não suportados.
2. flow.mjs: fronteira de requisições cancelável por CNPJ, trava contra duplo clique, validação da identidade do perfil contra workspace da sessão, isolamento das listas A/B e classificação sem confundir processamento/rejeição/incerteza com autorização. Status autorizado não se transforma em link público.
3. api.mjs: Bearer token Firebase obtido no momento da chamada, mesmo-origin + no-store, endpoints únicos permitidos, idempotência de POST e proibição de retry automático em timeout.
4. Resposta da API W10-III de NF-e continua 503 (fail-closed); W15 NÃO finge ter autorização WLG, XML SEFAZ, emissão fiscal, storage privado, pagamento, cancelamento ou CC-e. Nenhum item financeiro é baixado automaticamente.

## Handoff do integrador W10 (PATCH PROPOSTO, NÃO APLICADO)
Em components/company/CompanyOperationalModule.tsx, depois de integrar a autorização fiscal live e a API apropriada:
- importar: import { FiscalIssuanceWorkspace } from './fiscal/FiscalIssuanceWorkspace';
- na área 'notas-fiscais', montar <FiscalIssuanceWorkspace getIdToken={getIdToken}/> como subseção fiscal, preservando <FinanceWorkspace/> manual W8 como módulo separado; não substituir W8 sem homologação.
- verificação obrigatória: no GET /api/company/fiscal/nfe retornar, SOMENTE a quem tiver fiscal:read, um objeto {ok:true,items:[...],capabilities:{canIssue:true,companyId,issuerCnpj,environment:'homologacao'}} quando ALL gates live estiverem comprovados. O POST deve rejeitar sem fiscal:write, fiscal:approve, fiscal:issue e pedido W1 verificado; ignorar CNPJ do browser como autoridade; oferecer transaction/idempotency de verdade e não transformar um 'create_draft' em envio real sem aprovação assinada do W14.
- implementar endpoints privados de documento com ACL fiscal:download e verificação XML/protocolo; somente após isso habilitar botões de download. Não abrir URL pública, nem tratar DANFE como autorização.
- garantir que ao trocar CNPJ o shell/profiles/sessão sejam revalidados, que o frontend remonte por companyId, e que aplicações financeiras W8 continuem separadas.

**IMPORTANTE:** A intenção 'create_draft' em W15 é proposta de contrato de UI, NÃO compatível ainda com rota W14 503. O backend deve validar/revisar/autorizar em etapas independentes; não habilitar capabilities.canIssue apenas para destravar UI.

## Matriz QA (classificações estritas)
| Prova | Cobertura | Estado |
|---|---|---|
| UID com 2 CNPJs + UID somente A (fixtures) | seleção A/B, mismatch de escopo | Aguardando CI W15 |
| Revogação/suspensão de perfil (fixtures) | falta de perfil rejeitada | Aguardando CI W15 |
| WLG de B em A, produção, revogada/sem credencial (fixtures) | UI fail closed | Aguardando CI W15 |
| Duplo clique, troca A→B, abort, timeout POST (fixtures) | lock de submissão, no retry | Aguardando CI W15 |
| HTTP 202, rejeitada, incerta, autorizada (fixtures) | status distintos, sem falso XML | Aguardando CI W15 |
| TypeScript + build + Core | GitHub Actions W15 | Aguardando CI W15 |
| Isolamento server-side A/B e Firestore real | W10-III Auth/Firestore Emulator | Requer certificação do HEAD W15 |
| Chrome/Playwright desktop/mobile, acessibilidade visual | Não montado em app/empresa por respeito a ownership | SKIPPED |
| Emissão WLG/SEFAZ, assinatura XML, DANFE privado, download privado | Credenciais/licença/gates sem liberação | SKIPPED |
| Financeiro W8 sem baixa automática e portal militar sem regressão | proteção de Core/build; E2E W8 não executado por W15 | Parcial / Pendente |

Os testes de flow.test.mjs usam Node real e objetos/fetch **MOCK**, não uma API WLG real nem Auth/Firestore Emulator. Não reivindicar screenshots, emissão, sessão real ou Playwright.

## Parecer e rollback
**GO técnico somente para revisão isolada e integração futura sob W10**, condicionado a CI verde no SHA vigente. **NO-GO** para merge/main, produção, piloto, emissão NF-e, 2º CNPJ real, configuração WLG ou deploy. Rollback: descartar apenas esta PR/branch, sem dados de produção a reverter.
