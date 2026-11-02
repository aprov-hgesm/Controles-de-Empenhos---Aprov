# Eleonor R1 — hotfix de navegação e notas pendentes

## Incidente relatado
- Botão flutuante oculto em `/central-empenhos`.
- Menu lateral Eleonor muito abaixo das primeiras áreas e pouco descobrível.
- Resposta genérica a "o que vc pode fazer?" e "quais as nossas pendências?".
- Pergunta "Quais notas fiscais pendentes?" devolvia unsupported, apesar de existir estado operacional real das NFs.

## Causas comprovadas em código
- `EleonorExperience` renderizava `position:fixed` sob `main.overflow-hidden`, e outros elementos usam transforms/clipping.
- `AppSidebar` colocava Eleonor somente após as seções de gestão e acompanhamento.
- W7 não tinha resposta tipada sobre capacidades nem orientação para pendências sem categoria.
- W3 estava limitado à busca de NFs por período de cadastro; status de tramitação não possuía um contrato autorizado.

## Correção minimalista
- Portal React para `document.body`, somente após a montagem no cliente; chat completo permanece no fluxo normal. Não altera visual ou logotipos.
- Eleonor no início da navegação lateral, sem duplicar entrada.
- Orientação objetiva das capacidades e pergunta de esclarecimento para "nossas pendências" genérica.
- Novo contrato fechado de leitura `invoice.operationalPending.list.v1` — aceita apenas `stage='pending_operational'` e `pageSize<=50`. Reutiliza autorização W3, escopo workspace/UG, limite de 201 documentos examinados e evidências para os itens exibidos.
- A interpretação usa exclusivamente **pendências de tramitação**, nunca inferindo pagamentos, vencimentos ou liquidações. A etapa vem de `localizacaoAtual`; registros legados sem localização usam fallback histórico, sempre com ressalva de cobertura parcial. `TESOURARIA` é excluída dessa lista de tramitação.
- Consultas com filtros adicionais não representáveis são recusadas pelo `filterGuard`; não são ignoradas nem executadas com escopo ampliado.
- A lista fica truncada quando ultrapassa o limite; não declara um total consolidado.
- Testes sintéticos W3/W4/W7 cobrem escopo, fases, limitação e navegação.

## Não alteração
Sem IAM, sem Firestore Rules, sem escrita em NF, sem modificação em empenhos, sem mudança de segredos, sem merge do Atlas R2 e sem ativação indiscriminada do LFM3.

## Homologação
Certificar CI de TypeScript, regressão W3/W4/W5/W6/W7 e UI. Criar revisão Cloud Run sem tráfego antes de considerar promoção. A consulta real requer teste autenticado com dados da UG; os testes sintéticos não comprovam leitura produtiva.

**Atenção:** o nome "pendente" isolado tem significados diversos. Este contrato é exclusivamente de encaminhamento de nota (Aprovisionamento/Comissão). Pedido sobre pagamento pendente deve resultar em limitação explícita, não em lista enganosa.
