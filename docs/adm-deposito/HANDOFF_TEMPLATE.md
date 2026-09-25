# ADM Depósito — Template de Continuidade entre Chats

Use esta mensagem como ponto de partida para cada nova capacidade do módulo.

```text
Quero continuar o desenvolvimento do Módulo ADM Depósito / Área Logística do EMPROVEX exatamente de onde a fase anterior terminou.

Repositório:
aprov-hgesm/Controles-de-Empenhos---Aprov

Antes de alterar qualquer código:
1. confira a branch main real;
2. leia README.md, ROADMAP.md, DECISIONS.md, STATUS.md, `../EMPROVEX_CORE_PROTECTION.md` e este HANDOFF_TEMPLATE.md;
3. compare a main com o baseline do STATUS.md;
4. analise commits posteriores;
5. preserve decisões congeladas;
6. preserve contratos canônicos de material, ledger e saldo;
7. não avance automaticamente para a fase seguinte.

Neste chat, desenvolva exclusivamente:

FASE [NÚMERO] — [CAPACIDADE]

Regras:
- trate a fase como uma fatia vertical completa;
- implemente UI, domínio, persistência, segurança e testes necessários à capacidade;
- reutilize capacidades anteriores em vez de criar fontes de verdade paralelas;
- preserve todo o EMPROVEX existente;
- mantenha founder-only durante o piloto;
- use branch própria;
- execute gates adequados;
- abra PR e valide checks;
- faça merge somente após validação técnica;
- consulte `docs/DEVELOPMENT_CI_WORKFLOW.md` para definir a bateria proporcional ao impacto;
- use Cloud Shell de forma ativa para pré-validação/diagnóstico quando isso reduzir uma rodada longa de CI;
- quando pedir intervenção manual, forneça comandos curtos, seguros e copiáveis;
- Browser E2E completo é prioritário para mudanças que alterem jornada/interação do usuário;
- mudanças exclusivamente em `docs/**` não devem disparar o Application CI; não misture fechamento documental com arquivos funcionais/configuracionais se a intenção for usar essa exceção;
- atualize STATUS ao concluir;
- atualize DECISIONS apenas se houver decisão arquitetural definitiva;
- não inicie a fase seguinte no mesmo chat.
```

## Regra de uso

O template inicia a conversa; a fonte da verdade continua sendo a `main` e os documentos oficiais.

Se o texto do chat divergir deles, prevalecem GitHub e documentação versionada.


## Estado corrente após a FASE 10

Fase concluída e integrada à `main`:
- **FASE 10 — Inventário Físico**;
- PR: **#180 — feat: ADM Depósito phase 10 physical inventory**;
- squash merge funcional: **0a15586ff39d740f48f71c33c7cbff578835e11f**;
- Application CI #702 e Recovery guardrails #463: **aprovados**;
- decisões permanentes: **D-049, D-050 e D-051**;
- contrato técnico: **docs/adm-deposito/PHASE_10_PHYSICAL_INVENTORY.md**.

Capacidades que o próximo chat deve considerar existentes:
- material canônico warehouse_material_v1;
- ledger append-only warehouse_movement_v1;
- saldo agregado warehouse_balance_v1;
- distribuição física warehouse_location_balance_v1;
- projeção NF → estoque desacoplada e cutoff;
- SISCOFIS / Marco Zero / conciliação;
- depósitos, localizações, subposições e transferências;
- lotes, validade e FEFO consultivo;
- múltiplos barcodes e Saída Expressa;
- croqui operacional warehouse_depot_layout_v1;
- inventário total ou parcial por depósito/local/subposição;
- contrato warehouse_inventory_v1;
- itens warehouse_inventory_item_v1 em subcoleção bounded;
- contagem separada do saldo oficial;
- revisão e confirmação humana obrigatória;
- INVENTORY_ADJUSTMENT auditável e idempotente;
- controle otimista de concorrência por posição física;
- fila derivada de materiais sem localização;
- histórico de inventário preservado;
- founder-only e isolamento por workspace/UG.

Próxima fase oficial:
- **FASE 11 — Entregas, Dashboard Logístico e Alertas**.

Regras adicionais para a FASE 11:
- não duplicar o Planejamento/Cronograma já existente;
- NF cadastrada continua significando material recebido;
- integrar entrega → NF → projeção de estoque somente por leitura dos dados canônicos do EMPROVEX;
- manter alertas logísticos no namespace warehouse; não alterar a Central de Avisos nem suas Rules para atender o ADM;
- dashboard deve consumir projeções/materializações existentes e consultas bounded;
- preservar Inventário, SISCOFIS, lotes, FEFO, barcodes, Saída Expressa e Visão do Depósito;
- continuar founder-only;
- não antecipar a consolidação visual global da FASE 11.5;
- executar `npm run verify:emprovex-core-protection` e preservar o workflow `EMPROVEX Core Protection`;
- nenhuma falha do ADM, Drive, alerta logístico ou telemetria pode bloquear NF, empenho ou cronograma do EMPROVEX;
- reconciliar qualquer commit novo da main antes de editar código.

## Regra de fechamento documental

Depois que uma fase funcional estiver validada e integrada:
- atualizações exclusivamente documentais em `docs/**` podem registrar o fechamento oficial sem nova bateria do Application CI;
- mantenha essas atualizações separadas de código, Rules, scripts, testes, workflows ou configuração;
- se qualquer arquivo fora de `docs/**` fizer parte do diff, aplique novamente os gates proporcionais ao impacto.

## Planejamento visual já aprovado

A **FASE 11.5 — Consolidação Visual e UX do ADM Depósito** ocorrerá entre as FASES 11 e 12.

Diretriz principal:
- a direção estética será conduzida pessoalmente pelo fundador e refinada de forma iterativa;
- não fechar previamente cores, referências, intensidade de efeitos ou composição;
- até a FASE 11, limitar mudanças estéticas a usabilidade e consistência funcional;
- a reformulação visual global não deve ser antecipada.


## Estado corrente após os Módulos 6 e 7 da reorganização funcional

Branch de continuidade:
`feat/adm-deposito-phase-11-5-visual-ux`.

Concluído em 2026-09-25:
- **Módulo 6 — Meus Depósitos multi-depósito**;
- **Módulo 7 — Biblioteca de estruturas físicas**.

Capacidades a tratar como existentes:
- 1..N depósitos administráveis pelos contratos históricos;
- localizações/subposições com IDs estáveis e `UNASSIGNED` preservado;
- layout ativo e histórico independentes por `depotId`;
- `warehouse_depot_layout_v1` preservado sem schema concorrente;
- biblioteca estática `WAREHOUSE_STRUCTURE_LIBRARY` com Estante, Rack, Armário, Freezer, Geladeira, Câmara, Palete, Área de Paletes, Bancada, Corredor, Área Livre e Outra estrutura;
- defaults proporcionais/rotação e flags conceituais de níveis/subposições;
- objetos do croqui continuam sem autoridade sobre saldo;
- Firestore Rules permaneceram inalteradas.

Próximo módulo oficial:
- **Módulo 8 — Editor visual do croqui**.

Para o Módulo 8:
- consumir a biblioteca central existente;
- não criar outro catálogo, schema ou coleção;
- preservar layouts legados;
- não mover estoque ao mover/redimensionar/rotacionar objetos;
- manter editor leve 2D/2.5D;
- D-057 continua reservando a campanha completa de testes/CI para o Módulo 14.
