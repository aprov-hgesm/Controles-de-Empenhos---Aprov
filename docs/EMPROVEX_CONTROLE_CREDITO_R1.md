# EMPROVEX — Controle de Crédito | R1
Status: fundação financeira isolada, em desenvolvimento. Não integrado nem publicado.
Origem: solicitação de 24/11/2026. GOV-SIMP-01; release somente com autorização explícita.

## Escopo
Rota própria /controle-crédito (alias ASCII /controle-credito, sem redirecionar módulos existentes). Login independente em UI, reutilizando Firebase Auth; autorização explícita do módulo, vinculada a UID e UG, sem conceder acesso por mera autenticação no EMPROVEX. Gestor lê e grava somente a UG autorizada; Centro de Custos lê NCs pertinentes, sua alocação e suas NEs, sem gravação. Cadastro de centros por UG, com FARM, LAC, ODONTO, APROV e ALMOX como configuração inicial proposta para HGeSM (160416); não codificar como restrição global.

## Fluxos
Gestor: painel, NCs, empenhos, centros de custos, documentos/configuração. NC: upload SAG ou manual, revisão dos campos extraídos, valor, identificador e UG emitente/favorecida, emissão, ND, PI, PTRES, fonte, UGR, finalidade/observações e prazo de empenho/recolhimento se expressamente informado. Campos ausentes ou conflitantes exigem preenchimento/conferência; não inferir datas de emissão como prazo. Se houver múltiplas células orçamentárias ou documentos de reforço/anulação/recolhimento, manter linhas/eventos distintos e conciliar antes de contabilizar. Sem amostras reais de NC, não certificar parser.
NE: reutilizar parseEmpenhoPdfBytes (lib/server/empenhoPdfParser.ts) sob novo autorizador; não reutilizar diretamente o endpoint /api/empenhos/parse-ne porque seu gate é o da operação atual. Selecionar centro e confirmar NC, UG, célula orçamentária e valor; referência NC do parser é sugestão, não vínculo automático sem validação. Não duplicar empenho por reimportação; chave canônica de identidade UG + exercício + número, com ajuste/versionamento próprio, sem contabilizar reforços/anulações duas vezes. Vínculo com registro de empenhos existente somente quando autorização e UG compatíveis; evitar sincronização bidirecional e duplicação de documentos.
Centro de Custos: painel e listagem de NCs destinadas e NEs do próprio centro, consulta somente; sem visibilidade de outros centros por padrão. Exibir dados gerais da NC necessária ao contexto, sem expor distribuição alheia.

## Núcleo e persistência
Núcleo puro lib/controle-credito/creditBalance.ts: centavos inteiros, pontos-base, rateio <=100%, saldo não destinado explícito, rounding pelo maior resto determinístico, saldo global e setorial, contagem e alertas; não confundir prazo vencido com recolhimento efetivo. Rateio editável após NEs: preservar histórico e mostrar déficit se novo limite < comprometido; sinalizar antes de confirmar. Não apagar nem truncar saldo negativo. Para lançamento real já emitido acima da cota, exigir conciliação explícita em vez de ocultar a obrigação; para planejamento, impedir novo gasto incompatível.
Modelo proposto: namespace exclusivo por UG financeira e membros por UID (gestor/centro), NCs, NEs e movimentos de ajuste, auditoria mínima; não confundir UG financeira com workspace setorial existente. Definir contrato e autorização server-side antes de criar coleções/Rules; negar acesso direto por padrão. Transações server-side para idempotência, revisão concorrente, consistência global/setorial e trilha de edição. Não armazenar totais divergentes; projeções agregadas atômicas apenas quando necessárias, consulta paginada, sem listeners duplicados. Alertas derivados do saldo/prazo na consulta; sem cron novo. Inicialmente 7 dias, hoje, vencido, prazo ausente e sem NE; timezone institucional. Diferenciar saldo registrado de saldo oficial SIAFI; sem automação de pagamento.
Teste unitário: node --test scripts/controle-credito-balance.test.mjs (usa TypeScript já existente).

## Drive
Reusar integração e padrão documental do EMPROVEX; pasta própria, integridade e metadados, upload confirmado, visualização/download/impressão. PDFs privados por padrão. Preferir compartilhamento automatizado por e-mail autorizado do centro (type=user/role=reader), ou proxy autenticado se a arquitetura atual sustentar autorização delegada segura; jamais compartilhar token OAuth do gestor. Alternativa link anyone/reader somente mediante política explícita da UG, pois acesso fora do EMPROVEX não é limitado por seus perfis; não ativar automaticamente de modo irrestrito. Respeitar canShare, restrições organizacionais e revogação; falha no compartilhamento não invalida cadastro nem saldo. Não criar novas credenciais ou serviço Drive sem necessidade.
Referência: https://developers.google.com/workspace/drive/api/guides/manage-sharing e https://developers.google.com/workspace/drive/api/guides/resource-keys.

## Entrega incremental
1. Fundação de domínio e testes (esta branch).
2. Contrato de identidade/autorização e persistência com emulador; login e shell reaproveitando componentes.
3. Cadastro NC manual, rateio, NE via parser existente, ajustes e painel.
4. Parser SAG NC com PDFs reais variados, fixtures desidentificadas e testes determinísticos.
5. Drive e acesso a documentos por centro, QA integrado, testes de isolamento e regressão proporcionais; PR draft até homologação.
Não modificar main, Firestore produtivo, regras atuais, OAuth, cobrança ou Cloud Run nesta fundação. Próximos passos dependem de código existente e amostras reais; sem afirmar homologação antes dos testes.
