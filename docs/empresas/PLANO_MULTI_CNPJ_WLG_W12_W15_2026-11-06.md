# EMPROVEX Empresas — expansão multi-CNPJ e emissor NF-e WLG (R1)
**Data de referência:** 06/11/2026. **Status:** decisão arquitetural e prompts de execução. **Sem código integrado, merge, deploy, cadastro real, envio de NF-e ou contratação de API.**

## 1. Decisão

Uma **única identidade Firebase Auth (UID)** pode ser autorizada a atuar em **várias empresas legais** (cada uma com seu CNPJ), trocando o perfil ativo no portal. **Cada CNPJ é um workspace empresarial independente**, com dados, membros e papéis, produtos, pedidos, estoque, compras, financeiro, emissões fiscais, auditoria e conexão WLG **próprios**, mesmo quando o mesmo usuário é titular dos dois.

O seletor é uma interface, nunca mecanismo de autorização. A cada operação, o servidor verifica UID, e-mail validado, status e autorização *live* naquele workspace, papel/ação e pertença do recurso. Dados e cache do CNPJ A nunca devem aparecer no B; ao alternar, invalidar consultas e estados anteriores. Não criar novos Firebase Auth users para a mesma pessoa nem converter conta militar/fundadora em empresa por fallback. Respeitar a identidade Google do fundador e o acesso setorial existente.

**Atenção ao código existente:** W0 PR #511 @ `16b763e929342b6ea1f5858470cc670c9ea5a3f4` mantém `platformAccounts/{email}.workspaceId` e `platformAuthUidIndex/{uid}.workspaceId` como vínculos *singulares*; `verifyCompanySession` exige igualdade exata entre ambos e workspaces. Portanto, um segundo CNPJ não pode ser criado usando os mesmos fluxos de provisionamento sem uma migração/adaptação aditiva do diretório empresarial. Esse ajuste de sessão, índices, locks e guard central pertence **somente ao integrador W10**, com testes de regressão fundador/setores/owner.

## 2. Estrutura recomendada

```text
Firebase Auth UID (identidade única)
       |
       +-- memberships reais e verificadas em servidor --> Empresa A / CNPJ A
       |     supplierCompanyWorkspaces/{companyIdA}/...
       |     fiscalConnections/wlg --> empresaId WLG A, credencial A, ambiente A
       |
       +-- memberships reais e verificadas em servidor --> Empresa B / CNPJ B
             supplierCompanyWorkspaces/{companyIdB}/...
             fiscalConnections/wlg --> empresaId WLG B, credencial B, ambiente B
```

- A coleção global de índice de vínculos por UID pode acelerar listagem de perfis **mas nunca outorga acesso sozinha**. A fonte final é o vínculo verificável por empresa, com titularidade autorizada, membro ativo e capability por ação. Não usar e-mail/CNPJ do navegador como prova de titularidade.
- Provisionar segundo CNPJ para o mesmo titular **sem criar segunda conta Auth**: verificar prova de que pode representar o segundo CNPJ, unicidade via índice CNPJ transacional, idempotência e transação de vínculos; preservar os índices legados do W0 e índices setoriais. Distinguir `owner` em A e `member` em B; não promover automaticamente a owner por compartilhar UID/e-mail. Convidados W3 podem ser membros de várias empresas após aceite independente.
- Seleção ativa: `companyId` é somente escolha; backend revalida membership/owner e companhia ativa a cada request e vincula a operação ao tenant selecionado. Um estado/cookie de seleção deve ser assinado e vinculado a UID/sessão, Secure/HttpOnly/SameSite, com proteção CSRF adequada para operações por cookie. Nunca confiar em querystring, localStorage, claims arbitrárias ou parâmetro `empresaId` para autorizar.
- O tenant selecionado é obrigatório para operações empresariais com múltiplos vínculos; para usuário legado com **uma** empresa, manter compatibilidade sem confundir essa simplificação com autorização. Rotas antigas devem funcionar sem permitir acesso cruzado.
- Não misturar dados fiscais de duas pessoas jurídicas nem transferir automaticamente estoque, notas, custos, preços, histórico ou pedidos. Billing/assinatura por usuário vs por CNPJ exige decisão comercial posterior; esta expansão **não** muda a cobrança nem habilita piloto.

## 3. Provedor fiscal: WLG (situação verificada em 06/11/2026)

Fonte oficial da WLG: https://wlgsistemas.com.br/api-emissao-nfe .
O provedor anuncia API REST gratuita sem limite de notas, NF-e 55 e NFC-e 65; operação assíncrona por `operationId`, `empresaId` no envio, autenticação `clientId/clientSecret` por `POST /api/v1/auth/token` (token 1h), `POST /api/v1/nfe` com `tipoAmbiente=2` na homologação, `GET /api/v1/operacoes/{id}` para situação e downloads de XML/DANFE após autorização. Cancelamento e CC-e são anunciados. A documentação Swagger é indicada em https://fiscal.wlgsistemas.com.br/swagger ; **detalhes completos de schemas, scopes de token, limites e endpoints de eventos exigem leitura do Swagger atualizado em execução**. Não inventar endpoints ou comportamento de webhooks.

A WLG também anuncia *várias empresas na mesma conta* (https://wlgsistemas.com.br/emissor-nfe-multiempresas). Isso **não comprova** que cada `clientId/clientSecret` possa ser restrito a um único `empresaId`. A exigência EMPROVEX é **uma conexão lógica WLG vinculada a cada workspace/CNPJ**, com configuração/segredo e acesso totalmente segregados no nosso servidor. Preferir credenciais distintas **por CNPJ**, se a WLG oferecer; se forem credenciais globais de uma conta multiempresa, nunca permitir que o cliente escolha `empresaId` e exigir verificação servidor–provedor de emitente, escopo e CNPJ, registrando a menor separação possível. Só aceitar o fallback com risco documentado e aprovação técnica/comercial. Não reutilizar credenciais entre empresas de titulares distintos por conveniência.

**BLOQUEIO JURÍDICO/COMERCIAL P0:** https://wlgsistemas.com.br/termos-de-uso (versão 2026-11-01, §12) proíbe "revender ou disponibilizar a Plataforma a terceiros sem autorização da WLG"; o site anuncia integração com ERPs, mas isso não equivale a autorização expressa para oferecê-la integrada a um SaaS multi-cliente. Solicitar à WLG **confirmação escrita** de permissão para EMPROVEX SaaS/white-label e de modelo multi-CNPJ/credenciais. §5 prevê possibilidade de introduzir preços/limites, com aviso mínimo de 30 dias e contratação expressa; não prometer gratuidade perpétua. §7: certificado digital A1 é configurado na WLG; o EMPROVEX não precisa custodiar PFX/senha se esse fluxo for mantido. §9: preservar cópia própria autorizada de XML/DANFE; não depender exclusivamente da conta WLG. NFS-e NÃO está disponível segundo a WLG.

**Perguntas mínimas ao fornecedor (antes da produção, sem enviar automaticamente):** (1) podemos integrar a API no SaaS EMPROVEX usado por clientes distintos e cobrar assinatura do nosso software? (2) a API permite 1 par de credenciais com escopo estrito por `empresaId`/CNPJ ou requer contas separadas? (3) como provar vínculo `empresaId`↔CNPJ/emitente, gerenciar troca/rotação de segredos e revogação? (4) há idempotência de emissão, consulta de número/série e reconciliação após timeout, webhooks oficiais e quotas? (5) quais ambientes/UFs/modelos e eventos são suportados, e quais são os requisitos de retenção/exportação e SLA?

## 4. Segurança e consistência fiscal

- Frontend envia intenção de emitir e dados revisáveis; somente o servidor associa o **CNPJ emitente** e o `empresaId` WLG do workspace validado. Validar que os campos `emitente` e XML autorizado correspondem ao CNPJ do workspace. Um CNPJ suspenso, sem autorização/certificado ou configuração WLG válida NÃO emite.
- Separar por perfil `fiscalConnections/wlg` (metadados e referência segura, sem segredo em texto), `fiscalDocuments/{id}` (tentativas, estado, XML/DANFE e auditoria, após contrato W10), séries e numeração por CNPJ/ambiente. Segredos em gerenciador apropriado/criptografado no servidor, com IAM mínimo, rotação e não-exibição posterior; não registrar tokens, secrets, XML integral ou CPF em logs. Configurar credenciais sem permitir vazamento por navegador.
- Um único comando de emissão por intenção/dados revisados e série/número; reservar transacionalmente a numeração; diferenciar `draft`, `ready_for_review`, `submitted`, `processing`, `authorized`, `rejected`, `canceled`, `uncertain`. Recebido HTTP 202 NÃO é NF autorizada. Sem confirmação segura de falha da rede, **não reenviar automaticamente** a mesma nota: reconciliar `operationId` e status, marcar ambiguidade para intervenção. Não prometer exatamente-uma-vez na API remota se a WLG não garantir idempotência.
- CFOP, NCM, CSOSN/CST, impostos, natureza, série, modalidade e destinatário devem ser conferidos pelo responsável fiscal/contador. Pedido W1 e compra W6 podem preencher apenas referências fáticas verificadas, não inferir tributação. W8 não cria conta a receber/pagar automaticamente a partir do status da NF sem integração idempotente e decisão aprovada; W5 armazena XML/DANFE apenas com acesso privado.
- Homologação de ponta a ponta (`tipoAmbiente=2`) com identidades e empresas demo, simulador de WLG para cenários de erro e cancelamento; emissão em produção (`tipoAmbiente=1`) fica em kill switch separado e desligado até autorização expressa, contrato WLG e aprovação do piloto.
- Fonte de verdade fiscal: XML/protocolo autorizado na SEFAZ; DANFE é representação. Guardar evento, chave, protocolo, data, hash/integridade, ambiente, status e histórico da consulta; retenção e download/exportação com política fiscal e LGPD aplicáveis.

## 5. Plano de execução e ownership

| Worker | Escopo isolado | Paralelismo | Entrega |
|---|---|---|---|
| **W12 — Perfis empresariais multi-CNPJ** | `features/company/profiles/**`, `lib/company/profiles/**`, `app/api/company/profiles/**` | Núcleo puro pode iniciar em paralelo ao W13, **sem editar W0** | Seleção segura, modelo de membership N:1, cadastro adicional por CNPJ em proposta de patch ao W10, testes de isolamento |
| **W13 — Conector WLG por CNPJ** | `lib/company/fiscal/wlg/**`, `app/api/company/fiscal/connections/**` | Paralelo ao W12, com adapter/mock e sem credenciais reais | Cliente WLG autenticado, vínculo `empresaId`, proteções por tenant, mocks e provas de API |
| **W14 — Motor de emissão NF-e** | `lib/company/fiscal/issuance/**`, `app/api/company/fiscal/nfe/**` | Após contratos W12/W13 disponíveis, **não precisa merge na main** | Intenção, revisão, emissão assíncrona, status, XML/DANFE, eventos; não alterar finanças W8 |
| **W15 — Portal fiscal e QA** | `features/company/fiscal/**`, `components/company/fiscal/**`, `tests/company/fiscal/**` | Após W14, sem editar shell W4/W10 | UI de perfis/conexões/emissão/consulta e testes E2E multi-CNPJ, handoff integrador |
| **W10 (integrador existente, não substituído)** | Contratos/guard/sessão, provisioning, `app/empresa/**`, workflow central | Checkpoint após contratos W12/W13, final após W14/W15 | Autorizações live, migração aditiva, costura de UI/APIs, regressões e GO/NO-GO |

**Ordem prática:** W10 conclui a Etapa I já em andamento → W12 e W13 em paralelo (sem tocar arquivos de W10) → W10 valida patch mínimo e entrega base integrada → W14 e depois W15 → W10 integra e homologa fase fiscal após W9/W11, ou em release isolada se não houver interdependência. Nenhum Worker deve ser iniciado com promessa de emissão produtiva enquanto autorização da WLG estiver pendente.

## 6. Gates objetivos

**GO para desenvolver**: documentação oficial da WLG acessível, desenho de isolamento, contratos W0/W3, branches independentes, testes com mocks e Auth/Firestore Emulator demo.

**NO-GO para comercialização/produção** se qualquer: (a) autorização WLG para SaaS e escopo de credenciais não esclarecidos; (b) usuário consegue ver/emitir usando empresa de outro tenant; (c) dupla emissão em retry/timeout; (d) XML de CNPJ divergente; (e) segredo exposto no frontend/log; (f) emissão sem confirmação humana; (g) regressão login militar/fundador; (h) ambiente prod/kill switch ativado sem autorização; (i) cópia fiscal/exportação não confiável.

**Evidências mínimas:** um UID com dois CNPJs autorizados e alternância real, outro UID não autorizado rejeitado; duas empresas A/B com NF/status/segredos distintos; testes de revogação com sessão aberta; prova negativa de troca de `empresaId`; timeout entre POST e resposta; retorno 202 vs autorização real; rejeição, cancelamento, credencial revogada e recuperação; XML/DANFE somente do tenant correspondente; TypeScript/build/Core/Visual e Playwright empresa desktop/mobile. Os testes de WLG mockado devem ser identificados como **mock**, jamais emissão real.

## 7. Documentos normativos e contratos que precedem este plano
- [Memorial Oficial Empresas](../EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md), prompts detalhados W12–W15 anexados ao final da seção de Workers.
- [Auditoria R1-M](AUDITORIA_R1M_PLANO_WORKERS_2026-11-05.md).
- W0 PR #511, W3 PR #514, W4 PR #512, W5 PR #515, W8 PR #517, W10 PR #520.
- Fontes WLG: https://wlgsistemas.com.br/api-emissao-nfe ; https://wlgsistemas.com.br/emissor-nfe-multiempresas ; https://wlgsistemas.com.br/termos-de-uso ; https://wlgsistemas.com.br/politica-de-privacidade ; https://fiscal.wlgsistemas.com.br/swagger .

Este documento é um PLANO e não certificação de integração com fornecedor, autenticação de produção ou autorização comercial.

## 8. Checkpoint de integração W10 — Etapa III (registrado em 06/11/2026)

A integração fiscal **não** é executada pelos Workers W12/W13/W14 isolados. O integrador W10 deve criar **nova branch e PR Draft**, partindo do HEAD de W10 Etapa II PR #525 (referência `49c8670a66ad858724454eff0683696dcb7efcd3`). Importará módulos W12 PR #521, W13 PR #522 e W14 PR #526, respeitando que W14 **já deriva de W13**, sem duplicar o conector. O checkpoint cobre: identidade multi-CNPJ real, índices aditivos W0/W3, autorização live por tenant, conexão WLG segregada, reserva transacional e FSM NF-e, verificação confiável de XML/DANFE, testes Auth/Firestore Emulator A/B e CI. Na ausência de licença escrita WLG/segredos/provas fiscais, API de emissão fica **503/fail-closed** e piloto/produção **OFF**. UI W15 tem seu próprio checkpoint após contratos.

**Prompt integral:** [W10_ETAPA_III_PROMPT_INTEGRACAO_MULTI_CNPJ_WLG_2026-11-06.md](./W10_ETAPA_III_PROMPT_INTEGRACAO_MULTI_CNPJ_WLG_2026-11-06.md), também transcrito no Memorial Oficial. Este é um registro documental; não houve implementação, CI, conta WLG ou emissão fiscal por este commit.
