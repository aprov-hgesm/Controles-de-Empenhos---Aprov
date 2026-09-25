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

## Estado corrente após o Módulo 8 da reorganização funcional

Branch de continuidade:
`feat/adm-deposito-phase-11-5-visual-ux`.

Concluído em 2026-09-25:
- **Módulo 8 — Editor visual do croqui**.

Tratar como existente:
- `warehouse_depot_layout_v1` como único contrato persistido;
- `WAREHOUSE_STRUCTURE_LIBRARY` como catálogo único;
- editor em planta 2D com drag/resize/rotação;
- grade/snap opcionais, zoom e pan;
- undo/redo local;
- duplicação, exclusão visual e camadas;
- prévia 2.5D leve derivada dos mesmos objetos;
- vínculo `warehouseLocationId` limitado ao depósito selecionado;
- versionamento explícito por Salvar versão;
- ausência de writes Firestore durante interação;
- Firestore Rules e Core EMPROVEX inalterados.

Próximo módulo oficial:
- **Módulo 9 — Integração croqui ↔ estoque**.

Para o Módulo 9:
- não reimplementar o editor;
- consumir o layout ativo e os vínculos `warehouseLocationId` existentes;
- focar destaque/consulta de material e integração visual com saldos/posições;
- não fazer geometria mover estoque;
- manter D-057 e não executar campanha global antes do Módulo 14.


## Estado corrente após os Módulos 9 e 10 da reorganização funcional

Branch de continuidade:
`feat/adm-deposito-phase-11-5-visual-ux`.

Concluído em 2026-09-25, nesta ordem:
- **Módulo 9 — Integração croqui ↔ estoque**;
- **Módulo 10 — Finalização da aba Início**.

Tratar como existente:
- `warehouse_depot_layout_v1` continua autoridade do croqui;
- saldos/lotes continuam autoridades quantitativas;
- `warehouseLocationId` liga posição real a objeto visual;
- Início carrega somente o layout ativo do depósito selecionado;
- múltiplas posições podem ser destacadas;
- FEFO usa o motor oficial;
- localização sem objeto visual continua informada;
- clique em estrutura mostra apenas contexto da pesquisa;
- geometria nunca movimenta estoque;
- Firestore Rules e Core EMPROVEX permaneceram inalterados;
- D-057 continua reservando campanha global ao Módulo 14.

Próximo módulo oficial:
- **Módulo 11 — Consolidação do Controle de Itens**.

O Módulo 11 ainda não foi iniciado.


## Handoff após Módulos 11 e 12 — 2026-09-25

Estado oficial para o próximo chat:

- branch de continuidade: `feat/adm-deposito-phase-11-5-visual-ux`;
- Módulo 11 — Consolidação do Controle de Itens: **CONCLUÍDO**;
- Módulo 12 — Relatórios Logísticos: **CONCLUÍDO**;
- Módulo 13: **NÃO INICIADO**;
- Core EMPROVEX não foi alterado;
- Firestore Rules e índices não foram alterados;
- nenhuma publicação, PR ou merge foi realizada;
- campanha global de CI/E2E permanece reservada pela D-057.

Antes de iniciar o próximo módulo, recupere o HEAD real da branch e releia:
- README.md;
- ROADMAP.md;
- DECISIONS.md;
- STATUS.md;
- EMPROVEX_CORE_PROTECTION.md.

Próximo trabalho autorizado:

**Módulo 13 — Segurança, Firestore, performance e telemetria.**

O Módulo 13 deve auditar e endurecer a implementação existente; não deve reimplementar Controle de Itens nem Relatórios Logísticos e não deve criar materialização/cache de relatórios sem decisão arquitetural formal.


## Handoff após Módulo 13 — 2026-09-25

Estado oficial:
- branch de continuidade: `feat/adm-deposito-phase-11-5-visual-ux`;
- Módulos 1–13: concluídos conforme documentação modular;
- Módulo 14: **NÃO INICIADO**;
- founder-only permanece obrigatório;
- nenhuma expansão externa foi autorizada;
- nenhuma publicação/merge decorre automaticamente deste fechamento.

Hardening consolidado:
- Rules sem delete físico de material canônico;
- ledger/saldos preservados;
- Dashboard/Alertas com degradação segura de fontes auxiliares;
- Estoque com índices em memória;
- Inventário sem releitura duplicada do catálogo;
- telemetria warehouse reutilizando o estimador bufferizado do EMPROVEX;
- sem listeners novos, sem cache de relatório, sem índice composto preventivo.

Próximo trabalho autorizado, somente em novo passo:
**Módulo 14 — Campanha final de validação e fechamento.**

O Módulo 14 deverá executar a campanha consolidada prevista em D-057 antes de qualquer conclusão sobre merge, deploy ou expansão externa.


## Handoff de planejamento para o Módulo 14 — 2026-09-25

O próximo chat de execução deve tratar como fonte oficial adicional:

`docs/adm-deposito/MODULE_14_FINAL_VALIDATION_PLAN.md`

Baseline registrada:
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD auditado: `2d8160db956296779bcf86c7040829776d4e20ef`;
- no momento do planejamento, a branch estava idêntica ao HEAD acima.

Antes de testar:
1. recuperar HEAD real novamente;
2. comparar com a baseline;
3. ler README, ROADMAP, DECISIONS, STATUS, PHASE_13_HARDENING, EMPROVEX_CORE_PROTECTION, DEVELOPMENT_CI_WORKFLOW e o plano do Módulo 14;
4. não reimplementar funcionalidades dos Módulos 1–13;
5. tratar o Módulo 14 como estabilização/validação, não como nova fase funcional.

Ordem operacional:
- Core Protection/isolamento/guards;
- testes de domínio;
- TypeScript;
- Firestore Emulator/multitenancy;
- walking skeleton;
- build;
- Browser E2E específico do ADM;
- regressão EMPROVEX/ADM;
- correções consolidadas;
- reexecução seletiva;
- regressão final completa;
- PR e Application CI.

Achados preparatórios a não esquecer:
- E2E genérico atual não cobre explicitamente as jornadas ADM;
- `verify:adm-deposito-phase-11-5` deve fazer parte da campanha local e ser avaliado para o CI final.

PowerShell é o ambiente preferencial da campanha local; solicitar intervenção do fundador em blocos curtos/consolidados. Cloud Shell apenas quando necessário. Não autorizar expansão externa automaticamente após sucesso técnico.


## Handoff de prioridade pós-ADM — 2026-09-25

Além do plano do Módulo 14, o próximo trabalho deve respeitar a sequência oficial registrada em:

`docs/adm-deposito/POST_ADM_STABILIZATION_AND_SECURITY_PLAN.md`

Ordem:
1. concluir ADM Depósito/Módulo 14;
2. bateria dedicada de testes e melhorias do ADM com uso real;
3. hardening de segurança de dados da plataforma.

Não iniciar o pacote transversal de hardening preventivo no meio do fechamento do ADM sem motivo crítico. Se surgir vulnerabilidade crítica confirmada, ela se torna bloqueante e deve ser tratada imediatamente.

Não interpretar essa priorização como autorização para expansão ampla de usuários externos antes da estabilização e revisão de segurança.
