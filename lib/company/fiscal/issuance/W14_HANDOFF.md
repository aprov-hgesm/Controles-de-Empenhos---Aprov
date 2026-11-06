# W14 — EMPROVEX Empresas | Motor isolado de NF-e (06/11/2026)

**Missão:** implementar a máquina de estados, reserva, revisão humana, autorização assíncrona, XML e DANFE **sem emissão fiscal real**. Sem merge, deploy, acesso a credenciais ou alterações setoriais.

## Linhagem e dependências

- Memorial e planejamento: PR #510, docs/EMPROVEX_EMPRESAS_MEMORIAL_OFICIAL.md e docs/empresas/PLANO_MULTI_CNPJ_WLG_W12_W15_2026-11-06.md.
- Base comum W10 #520: 46af306ea67e2c5d45f8a2af922ef2781e154212.
- Branch W14 criada a partir do HEAD W13 #522: d17c45d9e809332a9a396a20f12391ed5322bed6 (descendente da base W10), para usar o conector WLG e o contrato index.d.mts **sem copiar seu código**.
- W12 #521 (f6fe0743df07d34c5161de58e985e30857d2060e) fornece o contrato de perfis, mas não integra o W0/W10: sessão multi-CNPJ real e guard fiscal ainda pendentes.
- W1 #513: pedidos de clientes; W5 #515: armazenamento privado; W8 #517: financeiro. Nenhum arquivo de outro Worker foi editado.

## Entregas

- lib/company/fiscal/issuance/index.mjs: engine server-only injetável com state machine e callbacks de autorização, conexão W13, pedido validado, Firestore CAS, verificação criptográfica independente do XML e armazenamento privado.
- index.d.mts: tipos e contratos explícitos para o W10 e para a UI W15.
- w14.test.mjs: cenários determinísticos com dublês de persistência, provedor e XML; nunca chamá-los de homologação SEFAZ, WLG real ou Firestore Emulator.
- app/api/company/fiscal/nfe/route.ts: GET/POST sob guard W10 existente que retornam **503 NFE_INTEGRATION_PENDING** depois de validar a sessão; sem endpoints de emissão produtiva nem side effects.
- .github/workflows/emprovex-empresas-w14.yml: suíte de mocks + TypeScript + Core Protection + build, executados sem deploy.

## Transições e garantias

1. draft → ready_for_review: validar via adapter W1 a titularidade e a disponibilidade/alocação de todas as linhas de uma NF parcial, guardar revisão do pedido, revalidar na submissão e bloquear POST se houve alteração; exigir dados fiscais explícitos do usuário/revisor, NCM, CFOP, CST/CSOSN, ICMS/PIS/COFINS e destinatário; validar ownership da referência de pedido via W1.
2. ready_for_review → approved: aprovação humana **explícita** amarrada ao fingerprint do payload e ao CNPJ; papel fiscal:approve deve ser validado live pelo W10.
3. approved → submitted: CAS **durável e obrigatório ANTES do POST**; a mesma intenção jamais reenvia automaticamente. O adapter W13 aceita somente homologação e depende de flags OFF por padrão.
4. submitted → processing com operationId confirmado por WLG HTTP 202. O 202 **não** autoriza documento. Falha/timeout após envio vira uncertain; não tentar novo POST.
5. processing → processing/rejected/uncertain/authorized: consulta de operationId com backoff e orçamento de 12 polls; resposta SUCCESSO sem validação de XML e protocolo não autoriza.
6. authorized: chave NF-e com 44 dígitos e DV, emitente/CNPJ, série, número, ambiente, cStat 100, protocolo, XML assinado e verificação externa independente (assinatura, SEFAZ e cadeia de confiança), arquivo XML tenant-private com hash íntegro. O motor **não implementa** validação criptográfica; sem callback confiável retorna uncertain.
7. DANFE: PDF separado, archivePrivate tenant-aware, SHA-256 e referência não pública, só após XML autorizado. DANFE não é prova de autorização.
8. cancelamento e CC-e: 503 NFE_EVENTS_UNSUPPORTED_PENDING_CONTRACT; WLG Swagger/regras fiscais não confirmados.

A reserva de número/série exige transação durável única no W10 para (companyId, CNPJ, ambiente, série, número) e (companyId, idempotency-key, hash); o hash diferente é 409, mesmo comando retorna registro original. O store em memória nos testes é **mock** e não persiste produção. O schema pode ser mapeado após W10 incluir fiscalDocuments/series em contracts e índices.

## Handoff W10

- Integrar W12 e W13: guarda live multi-CNPJ de owner/member, papéis fiscal:read/write/approve/issue, workspace ativo, seleção assinada e CSRF; todo callback authorize() depende disso e **não pode receber dados do navegador**.
- Criar implementações server-only de FiscalStore (Firestore transaction + CAS de revision e audit) e archivePrivate via W5 com ACL de workspace; verifyOrder deve validar ownership, linhas, quantidades parciais/limites ainda não faturados, devolver fiscalAllocationVerified=true e revision estável, revalidando antes do POST. O mock W14 não é prova de estoque/saldo real. Não tocar W8 automaticamente.
- Resolver WlgConnection real vinculada ao CNPJ + referência Secret Manager + issuer proof verificada remotamente; uso não autorizado de empresaId do browser proibido. Manter flags de homologação e produção desligadas até gates.
- Prover verificador XML autenticado (assinatura XMLDSig, cadeia/autoridade, protocolo SEFAZ, emitente, chave, ambiente, integridade). **Não usar a checagem lexical W14 como prova criptográfica**.
- Só então conectar API fiscal e subcoleções, mantendo operação em homologação e kill switch. Sem integração, rota responde 503.
- Tratar crash na janela CAS→POST como uncertain ao recuperar submitted sem operationId; não criar reenvio automático. Projetar reconciliação manual segura e evitar alterar número reservado.
- Confirmar Swagger oficial WLG, permissão escrita para uso SaaS multi-cliente, modelo de credenciais/CNPJ e política de retenção/XML. Cancelamento/CC-e não são implementados.

## Handoff W15

- Construir interface de seleção por CNPJ (sem confiar em client-side authority), criação de intenção com digitação/conferência fiscal, revisão explícita com hash e confirmação, status de processamento/reconciliação e download privado.
- Não mostrar notas de A após alternar para B; abortar requisições e limpar caches quando mudar perfil.
- Exibir "Processando", "Rejeitada", "Verificação pendente" ou "Autorizada" somente segundo estado confiável; nunca chamar HTTP 202 de autorizada.
- XML e DANFE separados; download somente por sessão verificada, sem public URL nem tokens de WLG.

## Evidências e limites

- Casos automatizados cobrem dois CNPJs do mesmo UID, RBAC, bloqueio de empresa suspensa, conexão divergente, tributos obrigatórios, assinatura de aprovação, idempotência, concorrência/CAS, timeout, 202, rejeição, backoff, chave, XML de emitente errado, XML de produção, status rejeitado, DOCTYPE, assinatura/protocolo mockados, storage privado, DANFE distinto e bloqueios de eventos.
- **Ainda dependentes de W10:** E2E Auth/Firestore multi-CNPJ, escritor transacional real, guard fiscal real, provedor WLG autorizado, prova de XML SEFAZ real, storage W5 operacional, Chrome/Playwright desktop/mobile, emissão autorizada e cancelamentos reais. Todos ficam SKIPPED, não PASS.
- Sem licenciamento escrito WLG ou compatibilidade de credenciais, emissão em produção: **NO-GO**.

**Parecer inicial:** GO somente para revisão técnica do módulo e mocks, condicionado a CI do HEAD; NO-GO para integração operacional, merge, piloto, emissão real, Cloud Run e deploy.
