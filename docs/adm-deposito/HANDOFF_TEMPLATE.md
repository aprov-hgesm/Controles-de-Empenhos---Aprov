# ADM Depósito — Template de Continuidade entre Chats

Use esta mensagem como ponto de partida para cada nova capacidade do módulo.

```text
Quero continuar o desenvolvimento do Módulo ADM Depósito / Área Logística do EMPROVEX exatamente de onde a fase anterior terminou.

Repositório:
aprov-hgesm/Controles-de-Empenhos---Aprov

Antes de alterar qualquer código:
1. confira a branch main real;
2. leia README.md, ROADMAP.md, DECISIONS.md, STATUS.md e este HANDOFF_TEMPLATE.md;
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
- atualize STATUS ao concluir;
- atualize DECISIONS apenas se houver decisão arquitetural definitiva;
- não inicie a fase seguinte no mesmo chat.
```

## Regra de uso

O template inicia a conversa; a fonte da verdade continua sendo a `main` e os documentos oficiais.

Se o texto do chat divergir deles, prevalecem GitHub e documentação versionada.


## Estado corrente após a FASE 9

Última fase concluída:
- **FASE 9 — Código de Barras / Scanner / Saída Expressa**;
- PR de implementação: **#176**;
- squash merge funcional: `de11ad4f742eed3ca25a7f526c1ea5c78e113ec2`;
- decisões permanentes da fase: **D-042, D-043 e D-044**;
- contrato técnico: `docs/adm-deposito/PHASE_9_DEPOT_VIEW_LAYOUT.md`.

Capacidades que o próximo chat deve considerar já existentes:
- material canônico `warehouse_material_v1`;
- ledger append-only `warehouse_movement_v1`;
- saldo agregado `warehouse_balance_v1`;
- Walking Skeleton completo;
- NF → material → movimento → saldo;
- cutoff da integração NF → estoque;
- SISCOFIS com Marco Zero e snapshots de conciliação;
- depósitos, locais e subposições com identidade estável;
- distribuição física `warehouse_location_balance_v1`;
- transferências internas atômicas sem alterar o saldo total;
- lotes, validade e FEFO consultivo;
- Estoque operacional com ficha, origem, lotes, locais e histórico bounded;
- múltiplos barcodes/apresentações por material;
- scanner USB HID como teclado;
- pesquisa manual compartilhando o mesmo fluxo transacional;
- Saída Expressa como `OUTBOUND` atômico;
- proteção contra saldo agregado e físico negativo;
- lote opcional e FEFO sempre dependente de ação humana;
- idempotência preservada em retry;
- Firestore Rules especializadas para a Saída Expressa e validadas dentro do orçamento de avaliação;
- founder-only e isolamento por workspace/UG preservados;
- FASE 11.5 já reservada para consolidação visual/UX conduzida pelo fundador.

Próxima fase oficial:
- **FASE 10 — Inventário Físico**.

Regras adicionais para a FASE 9:
- usar croqui 2D com perspectiva tridimensional leve;
- representar estrutura física simples, sem desenhar produtos;
- vincular cada objeto operacional a `warehouseLocationId` estável;
- pesquisar material deve apenas destacar a localização real existente;
- mover objeto visual não pode movimentar estoque;
- FEFO pode orientar destaque, mas continua consultivo;
- persistir layout versionado sem criar fonte de verdade paralela para localização ou saldo;
- sincronização com Drive é complementar, não substitui Firestore/contratos logísticos;
- preservar completamente Visão do Depósito, editor e persistência versionada da FASE 9;
- não liberar ADM Depósito para usuários externos;
- não antecipar Inventário Físico da FASE 10;
- não iniciar FASE 10 no mesmo chat;
- reconciliar qualquer commit novo da `main` antes de editar código.

## Planejamento visual já aprovado

A **FASE 11.5 — Consolidação Visual e UX do ADM Depósito** ocorrerá entre as FASES 11 e 12.

Diretriz principal:
- a direção estética será conduzida pessoalmente pelo fundador e refinada de forma iterativa;
- não fechar previamente cores, referências, intensidade de efeitos ou composição;
- até a FASE 11, limitar mudanças estéticas a usabilidade e consistência funcional;
- a reformulação visual global não deve ser antecipada.
