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
- use Cloud Shell apenas quando necessário, preferindo consolidação;
- atualize STATUS ao concluir;
- atualize DECISIONS apenas se houver decisão arquitetural definitiva;
- não inicie a fase seguinte no mesmo chat.
```

## Regra de uso

O template inicia a conversa; a fonte da verdade continua sendo a `main` e os documentos oficiais.

Se o texto do chat divergir deles, prevalecem GitHub e documentação versionada.


## Estado corrente após a FASE 4

Última fase concluída:
- **FASE 4 — NF → Estoque**;
- PR de implementação: **#167**;
- decisão permanente adicionada: **D-033**.

Capacidades que o próximo chat deve considerar já existentes:
- material canônico;
- ledger append-only;
- saldo materializado;
- Walking Skeleton completo;
- vínculo persistido NF → material → movimento → saldo;
- idempotência de recebimento;
- correção e exclusão por movimento compensatório;
- cutoff de histórico;
- leitura real de Estoque e Movimentações;
- isolamento founder-only e multitenancy preservado.

Próxima fase oficial:
- **FASE 5 — SISCOFIS / Marco Zero / Conciliação**.

Regras adicionais para a FASE 5:
- não criar fonte de verdade paralela ao ledger;
- não fazer backfill silencioso do histórico;
- não enfraquecer o cutoff estabelecido na FASE 4;
- não liberar ADM Depósito para usuários externos;
- não iniciar FASE 6 no mesmo chat;
- reconciliar qualquer commit novo da `main` antes de editar código.
