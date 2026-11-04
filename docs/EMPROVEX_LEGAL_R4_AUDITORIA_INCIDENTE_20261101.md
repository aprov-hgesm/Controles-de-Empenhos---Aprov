# EMPROVEX — Auditoria direcionada de aceite jurídico R4 (01/11/2026)

**Incidente:** o usuário autentica, mas a tela "Termos e Privacidade" apresenta HTTP 503 ao registrar o aceite, bloqueando a entrada no sistema. Não há evidência de falha no LFM3. Correção isolada no contrato jurídico.

## Evidências e causa identificada no código

1. O registro do workspace fundador `workspaces/hgesm-aprov` existia com `status=active`, e-mail correto e **sem o campo `ug`**. A UG foi corrigida para string `160416`, preservando os demais campos. Confirmado pela leitura e atualização apresentadas pelo operador.
2. O acesso à tela passou a pedir o aceite R4. O navegador mostrou `/api/legal-acceptance` retornando **HTTP 503** na tentativa de aceite. A resposta JSON específica não estava disponível nesta auditoria.
3. Antes da correção, `readAcceptance()` exigia que a UG do registro imutável fosse igual à UG atual. O registro gerado pelo próprio backend com UG vazia usa `{nullValue:null}`; após a restauração da UG do fundador, `valueOf(fields,'ug')` passa a retornar `''`, diferente de `160416`. Nesse estado o GET responde `accepted:false`, e o POST tenta criar novamente o **mesmo ID** `uid__saas-r4-2026-10-27` com `currentDocument.exists=false`. Se o documento já existe, a API Firestore recusa e o backend devolvia o genérico `LEGAL_ACCEPTANCE_SAVE_FAILED` (503).
4. **Causa de código reproduzível:** a mudança legítima da UG invalidava um aceite que já era válido e imutável. É o mecanismo mais coerente com os eventos apresentados; sem acesso ao documento de aceite ou ao corpo JSON do erro 503, não é possível declarar que foi o único mecanismo ativo na produção.
5. **Hipótese alternativa preservada:** se o registro R4 não existir, um HTTP 503 no POST pode indicar permissão IAM insuficiente para criar documentos ou outro erro do Firestore. A identidade Cloud Run usa OAuth gerenciado (não exige JSON), e as respostas HTTP de leitura/escrita agora são registradas por **status numérico apenas**, sem payload, UID, e-mail, token ou corpo jurídico.

## Correção aplicada nesta branch

- `lib/server/legalAcceptanceRecord.ts`: verificador exato de identidade, workspace, UID, schema e versões; aceita UG exata de todos os tenants; aceita o registro **legítimo e imutável do fundador** com `ug:nullValue` somente com `acceptedAt` válido e UG atual `160416`. Não permite esse caso para outros workspaces ou e-mails.
- `app/api/legal-acceptance/route.ts`: reutiliza o registro existente sem escrever de novo; um registro incompatível recebe **409 `LEGAL_ACCEPTANCE_RECORD_CONFLICT`** em vez de tentar sobrescrever; falha real de Firestore permanece 503 com log de status upstream.
- A rota utiliza `CURRENT_LEGAL_BUNDLE` como fonte única do versionamento, sem travar exclusivamente R4. A próxima versão dos termos deve atualizar **`legalBundleVersion`** e os números de Termos/Privacidade no mesmo release. A identidade do documento muda automaticamente, e apenas então o aceite volta a ser obrigatório.
- Testes: aceites repetidos, histórico nulo do fundador, timestamps, isolamento cross-tenant, UID e e-mail divergentes, documentos falsos e mudança de versão. Preservado o pacote histórico R1 e as Firestore Rules.

## Segurança e limites

- Nenhum aceite histórico é excluído ou regravado.
- Nenhuma regra de acesso ao Firestore, IAM, billing, IA ou autenticação foi afrouxada.
- Aceite é **por usuário autenticado e por versão jurídica**, não global por organização. Outro usuário deve aceitar sua própria versão, mesmo na mesma UG.
- O gate continua falhando fechado quando o backend realmente não pode verificar a evidência.
- O sistema não presume consentimento LGPD genérico; registra apenas o aceite contratual.
- O evento `EMPROVEX_LEGAL_ACCEPTANCE_WRITE_UPSTREAM_STATUS` nos logs permite identificar especificamente `403`, `409` etc., se ainda houver falha de infraestrutura.

## Homologação e liberação

1. Certificar a branch com TypeScript, teste R4, testes de Rules existentes e build, sem reexecutar auditorias de outros módulos.
2. Mesclar apenas a correção pontual quando a CI aprovar, sem conflitar com trabalho paralelo.
3. Publicar pelo fluxo Cloud Run existente com stage 0% de tráfego, verificar saúde e promover mediante aprovação.
4. Confirmar em produção que a sessão fundadora passa a considerar o aceite vigente. Se surgir novo 503, usar o **status upstream registrado** para resolver pontualmente IAM ou erro de escrita. Não forçar um novo aceite nem alterar registros sem evidência.

**Importante:** a compilação e os testes sintéticos validam o código; não equivalem à leitura do registro jurídico real nem ao teste de usuário autenticado no domínio.
