# EMPROVEX AI — Piloto produtivo controlado R0

**Estado:** branch de integração ainda em revisão; não significa produção publicada.

## Objetivo e composição

- Base: `main` atual, incorporando o núcleo certificado W3–W6.1 da PR #450, sem reaproveitar a branch W6 isolada como imagem antiga de produção.
- Interfaces e personalidade são paralelos: **não alterar** a PR #453 (UI), #455 (matriz R1), #456 (Atlas R2) nem #457 (W7 conversacional). O W7 parte de uma revisão anterior do W6 e deverá ser atualizado/conciliado separadamente, sem substituir as correções W6.1.
- A ativação deste piloto é **somente do backend de consulta**, não disponibiliza automaticamente a interface Eleonor. O W3 continua como único executor autorizado; o LFM3 interpreta exclusivamente `MODEL_ELIGIBLE`.
- Não instalar novo Firebase, não copiar dados e não modificar o Ollama.

## Gates obrigatórios e reversíveis

A aplicação permanece fechada por padrão. Só habilita as duas rotas de IA se **todas** as condições estiverem presentes:

1. Cloud Run real com `K_SERVICE=emprovex-cloudrun-candidate`, `K_CONFIGURATION=emprovex-cloudrun-candidate` e `K_REVISION` pertencente a esse serviço; nunca Vercel, staging ou outro serviço.
2. `EMPROVEX_AI_W45_ENABLED=1` e `EMPROVEX_AI_PRODUCTION_PILOT_ENABLED=1` configurados explicitamente.
3. Token Firebase válido, e-mail verificado e identidade do setor fundador **com provedor autorizado**, conferidos pelo autorizador ANTES de buscar token de acesso Google ou consultar Firestore.
4. A identidade gerenciada da aplicação deve ser exatamente `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`; OAuth access token é obtido do Metadata Server, sem JSON privado, apenas para o caminho do piloto.
5. Para acionar o LFM3: `EMPROVEX_AI_LFM3_ENABLED=1`, `EMPROVEX_AI_LFM3_URL` com URL HTTPS válida do serviço `emprovex-ai-inference`, e `roles/run.invoker` da identidade **produtiva** concedido especificamente nesse serviço.
6. `EMPROVEX_AI_W45_CONTEXT_SECRET` e `EMPROVEX_AI_CURSOR_SECRET` configurados com material secreto seguro, sem publicar valores no GitHub.

**Desativação imediata:** configurar `EMPROVEX_AI_PRODUCTION_PILOT_ENABLED=0` bloqueia os endpoints; `EMPROVEX_AI_LFM3_ENABLED=0` desliga só o modelo. Se `EMPROVEX_AI_W45_ENABLED=0`, toda a fase de IA fica fechada. Não afeta módulos financeiros e logísticos existentes.

## Antes de mudar o tráfego do site

- Confirmar com `gcloud run services describe` qual serviço efetivamente recebe o tráfego produtivo; **não assumir** que o nome `candidate` identifica o domínio público.
- Confirmar service account efetiva do serviço, secrets e disponibilidade de permissão de leitura do Core e Warehouse, sem alterar políticas globais. Se o serviço real for diferente, **corrigir apenas o gate com revisão pontual antes de ativar**, e não mudar o roteamento para acomodar o código.
- Verificar CI da branch integradora (TypeScript, W6/W5, Fast CI/Core Protection) no SHA final. Não considerar testes isolados da PR #450 como prova de integração com a `main` atual.
- Publicar inicialmente com flags `EMPROVEX_AI_PRODUCTION_PILOT_ENABLED=0` e `EMPROVEX_AI_LFM3_ENABLED=0`; depois habilitar somente para o fundador e verificar uma consulta determinística (LFM3Calls=0) e uma elegível (LFM3Calls=1), sem escritas.
- Não ativar para os demais usuários antes de verificar os resultados e as permissões em produção. Não prometer respostas equivalentes à personalidade Atlas R2 até integrar a camada conversacional W7.
- IAM do serviço de inferência: a conta `emprovex-ai-w6-runtime` já tem `run.invoker`; **isso não concede automaticamente acesso** a `emprovex-run-runtime`. Verificar e conceder só a permissão por serviço, se ausente.

## Critério de GO/NO-GO

GO apenas depois da verificação de identidade/tráfego do serviço produtivo, CI do commit composto, permissões mínimas e os dois testes com a conta fundadora. Caso contrário, deixar o código e os flags desativados, sem promover a versão. Não iniciar projetos Firebase de homologação nem criar novas contas por padrão.

## Incidente P0 — LFM3 com flags/IAM corretos, mas respostas rejeitadas (02/11/2026)

Evidência em sessão produtiva: a pergunta de redação devolveu o fallback W7 fixo; a pergunta por fornecedor nomeado devolveu a mensagem de rejeição W5 `A interpretação não corresponde aos contratos permitidos`. A segunda mensagem ocorre quando a tentativa MODEL_ELIGIBLE retorna proposta JSON não nula, mas `validateModelCandidate()` não aceita o contrato; não é evidência de execução de W3. Flags W45/piloto/LFM3/W7 em 1, URL HTTPS da inferência e permissão run.invoker da service account produtiva confirmadas pelo operador, sem prova suficiente da qualidade da saída do modelo.

**Hotfix diagnóstico de desenvolvimento, sem ativação automática:** registrar no payload de `/ask` apenas o código seguro `metrics.modelOutcome`, nunca prompt, resposta bruta, token ou identidade. Categorias incluem falha IAM/HTTP, truncamento, JSON inválido, candidato rejeitado pelo contrato, filtro rejeitado ou consulta W3 aceita. O total `metrics.lfm3Calls=1` significa *tentativa*, não sucesso garantido.

**Aceite funcional necessário após publicação deliberada:** executar na conta fundadora duas mensagens sintéticas na Eleonor. Escrita genérica: resposta original `status=ok`, `route=CONVERSATIONAL`, `modelOutcome=model_answer_accepted`; fornecedor fictício nomeado: `route=MODEL_ELIGIBLE`, `modelOutcome=query_accepted` e resultado W3 `empty` ou `ok`, sem cross-workspace. Verificar LFM3 indisponível: fallback sem escrita. Não marcar o incidente como resolvido apenas por teste com mock ou por flag ativa.
