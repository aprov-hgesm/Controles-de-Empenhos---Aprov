# EMPROVEX — Organização funcional das abas de assinatura

**Escopo:** PR #385, área `/regularizacao`. **Decisão visual:** shell padrão do EMPROVEX, fundo claro e sidebar fixa à esquerda. **Privacidade comercial:** política de escalonamento futura **não pode ser mostrada** na página, no JavaScript cliente, no menu ou em exemplos.

## Estrutura e arquitetura

Os três atalhos originais estavam ligados a âncoras de uma página extensa; eram seções, não abas. A revisão estabelece `BillingPortalTab = overview | history | payments | help`: botões com `role=tab`, `aria-selected`, painel único `role=tabpanel`, suporte a teclado (setas, Home, End), sidebar fixa no desktop e recolhível no celular. O conteúdo muda por estado local sem navegação de rota, sem reload e sem cruzar contextos entre tenants. O retorno real do checkout seleciona automaticamente a aba Pagamentos, mas **não marca como pago**.

## 1. Minha assinatura — visão geral e próximos passos

**Pergunta que resolve:** “Minha conta está regular? Preciso fazer algo?”

**Implementado:** mostra o workspace autorizado, o email autenticado, o plano, status efetivo (teste, ativo, pendente, suspenso, cancelado ou isento), valor mensal **individual cadastrado** somente quando aplicável, prazo efetivo do trial quando existe e botões rápidos para Histórico, Pagamentos e Ajuda. A conta isenta permanece isenta; a tela não cria cobrança.

**Detalhamento adicional aprovado para etapa futura:** mostrar competência em aberto e o próximo vencimento **somente se houver ciclo materializado**, com ações claras de resolver pendência, sem inventar dívida a partir do calendário, e resumo dos últimos movimentos de cobrança. Não executar consulta extra se o registro não estiver disponível.

## 2. Histórico financeiro — rastreabilidade por competência

**Pergunta que resolve:** “Quais mensalidades existem e quais foram pagas?”

**Implementado:** abre tela própria; consulta *no máximo 24 competências efetivamente registradas* do próprio workspace autenticado, com competência, valor, vencimento, estado, total de registros consultados, contagem de pagas/abertas, busca local por competência/vencimento e filtro Todas/Em aberto/Pagas/Dispensadas. Informação indisponível não é equivalente a zero ou pago. Filtros não chamam Firestore e não escrevem dados. Contagem é relativa à amostra consultada, não ao histórico completo.

**Expansão futura:** detalhamento de cada competência com IDs opacos, linha do tempo de emissão/liquidação, comprovante/recibo oficial quando fornecido por integração confiável, exportação PDF/CSV, períodos e paginação; exigem persistência e autorização reais. Não prometer emissão fiscal sem módulo específico.

## 3. Formas de pagamento — fluxo seguro

**Pergunta que resolve:** “Como pago corretamente e como sei se meu Pix foi confirmado?”

**Implementado:** orientações das etapas cobrança individual → checkout oficial → conciliação. Assinaturas comuns continuam **desativadas** até existir checkout baseado na competência e settlement transacional certificado. O piloto real R$1 (se explicitamente habilitado para conta autorizada) é apresentado **somente aqui**, mediante consentimento e sem baixa de mensalidade. Dados de retorno são removidos da URL; retorno de navegador não comprova pagamento. As antigas formas manuais só são carregadas quando o usuário as solicita e permanecem separadas da assinatura ativa.

**Expansão futura:** exibir botão `Pagar competência X` *somente para ciclo pendente identificado*, checkout único por intent persistida e idempotente, `payment_check` autenticado, conciliação e baixa atômica no Firestore, tratamento de atraso/estorno/duplicidade, indicação clara de processamento e recuperação sem segunda cobrança. Nada disso fica habilitado por mera mudança visual.

## 4. Ajuda e orientações — autonomia do operador

**Pergunta que resolve:** “O que fazer quando meu pagamento ou status não está como esperado?”

**Implementado:** orientações contextualizadas sobre contas isentas/trial, pagamento pendente, recibos disponíveis, comprovantes no banco, impossibilidade de confiar só na URL de retorno, prevenção de Pix duplicado e canal oficial informado no cadastro. Atalho direto ao histórico. Nenhum contato de suporte inventado.

**Expansão futura:** protocolo de atendimento com acompanhamento, artigos por código de erro sanitizado, contestação de competência, solicitação de recibo e prova de encaminhamento; criar apenas quando existir backend/operador responsável. Não sugerir botão que não funcione.

## Critérios técnicos

- **Privacidade:** nenhuma tabela de preços progressivos, etapas futuras ou simuladores no bundle cliente; mostrar exclusivamente valor real da conta/ciclo autorizado.
- **Segurança:** UID, provedor, email e workspace vinculados; Firestore Rules mantidas; zero alteração em isenção, mensalidade, contrato ou cobrança pelas abas.
- **Usabilidade:** um único painel ativo por vez, navegação acessível e responsiva, estado visual selecionado, suportar teclado e botão voltar ao EMPROVEX.
- **Performance:** carregar histórico apenas ao abrir Histórico/Pagamentos, evitar consulta ao endpoint manual até pedido explícito, filtragem exclusivamente em memória.
- **QA:** testes estáticos, TypeScript, Chromium desktop/mobile, retorno InfinitePay, falha de configuração manual, navegação por teclado, isolamento do histórico e não exposição do escalonamento.
- **Operação:** PR #385 sem merge/deploy automático. Certificar composição e só então considerar publicação em main/Vercel pelo método staged + promoção manual.
