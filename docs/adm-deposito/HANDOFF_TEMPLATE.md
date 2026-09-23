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


## Estado corrente após a FASE 5

Última fase concluída:
- **FASE 5 — SISCOFIS / Marco Zero / Conciliação**;
- PR de implementação: **#171**;
- decisão permanente adicionada: **D-036**;
- contrato técnico: \`docs/adm-deposito/PHASE_5_SISCOFIS.md\`.

Capacidades que o próximo chat deve considerar já existentes:
- material canônico;
- ledger append-only;
- saldo materializado;
- Walking Skeleton completo;
- NF → material → movimento → saldo;
- cutoff da integração NF → estoque;
- prompt oficial para IA externa;
- contrato \`warehouse_siscofis_import_v1\`;
- validação rígida e preview antes da confirmação;
- Marco Zero auditável por \`INITIAL_BALANCE\`;
- recuperação idempotente de Marco Zero \`APPLYING → CONFIRMED\`;
- contrato \`warehouse_siscofis_snapshot_v1\`;
- snapshots posteriores somente para conciliação;
- estados \`MATCHED\`, \`DIVERGENT\` e \`UNRESOLVED\`;
- divergência sem autocorreção;
- Firestore Rules próprias para snapshots;
- isolamento founder-only e multitenancy preservado.

Próxima fase oficial:
- **FASE 6 — Depósitos / Localizações / Transferências**.

Regras adicionais para a FASE 6:
- preservar o ledger e o saldo existentes;
- transferência interna deve mudar localização sem alterar o total da OM;
- não transformar localização em uma segunda fonte de saldo;
- preservar Marco Zero, snapshots e cutoff da FASE 5;
- não usar divergência SISCOFIS para ajuste automático;
- não liberar ADM Depósito para usuários externos;
- não antecipar lotes/validade/FEFO da FASE 7;
- não iniciar FASE 7 no mesmo chat;
- reconciliar qualquer commit novo da \`main\` antes de editar código.
