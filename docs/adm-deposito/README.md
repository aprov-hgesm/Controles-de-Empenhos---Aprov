# ADM Depósito — Memória Oficial do Projeto

Esta pasta é a **fonte oficial de continuidade** do desenvolvimento do módulo ADM Depósito / Área Logística do EMPROVEX.

A partir da criação desta pasta, decisões, estado de implementação, sequência de fases e handoff entre conversas devem ser registrados aqui. Conversas do ChatGPT, mensagens isoladas e memória informal não substituem estes documentos.

## Documentos oficiais

- `ROADMAP.md` — plano completo de implementação, fases, blocos, gates e ordem de execução.
- `DECISIONS.md` — decisões arquiteturais e funcionais congeladas.
- `STATUS.md` — estado atual real do desenvolvimento, último commit validado, PRs, testes, riscos e próxima fase.

## Regra de continuidade

Antes de qualquer nova fase:

1. Ler `README.md`, `ROADMAP.md`, `DECISIONS.md` e `STATUS.md`.
2. Consultar a branch `main` real no GitHub.
3. Comparar a `main` atual com o último commit registrado em `STATUS.md`.
4. Se houver commits intermediários, avaliar impacto sobre o módulo antes de alterar código.
5. Desenvolver somente a fase designada para a conversa atual.
6. Trabalhar em branch própria.
7. Executar os gates adequados.
8. Abrir PR e só integrar após validação técnica.
9. Atualizar `STATUS.md` ao final da fase.
10. Atualizar `DECISIONS.md` somente quando uma nova decisão arquitetural definitiva for tomada.
11. Não avançar automaticamente para a fase seguinte no mesmo chat.

## Princípio de fonte da verdade

Quando houver divergência entre uma conversa antiga e estes arquivos:

- `DECISIONS.md` prevalece para decisões de arquitetura e produto;
- `ROADMAP.md` prevalece para sequência planejada;
- `STATUS.md` prevalece para estado de implementação;
- o GitHub/`main` prevalece para o estado efetivo do código.

## Escopo inicial

O módulo será desenvolvido e validado **primeiro somente na conta fundadora**. Usuários externos permanecem sem acesso às funcionalidades logísticas até o encerramento dos blocos DEP e autorização explícita para iniciar a expansão EXT.
