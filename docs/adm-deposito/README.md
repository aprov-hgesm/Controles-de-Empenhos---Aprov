# ADM Depósito — Memória Oficial do Projeto

Esta pasta é a **fonte oficial de continuidade** do desenvolvimento do módulo ADM Depósito / Área Logística do EMPROVEX.

A partir da criação desta pasta, decisões, estado de implementação, sequência de fases e handoff entre conversas devem ser registrados aqui. Conversas do ChatGPT, mensagens isoladas e memória informal não substituem estes documentos.

## Documentos oficiais

- `ROADMAP.md` — plano completo de implementação, fases, blocos, gates e ordem de execução.
- `DECISIONS.md` — decisões arquiteturais e funcionais congeladas.
- `STATUS.md` — estado atual real do desenvolvimento, último commit validado, PRs, testes, riscos e próxima fase.
- `HANDOFF_TEMPLATE.md` — mensagem padrão para abrir o chat da fase seguinte.

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

## Regra de intervenção externa / Cloud Shell

O desenvolvimento deve ser o mais autônomo possível.

Quando uma ação puder ser executada diretamente pelas integrações disponíveis ao agente, ela deve ser executada sem pedir intervenção manual do operador.

Quando uma etapa realmente exigir acesso externo que o agente não possua — por exemplo publicação de Firestore Rules, comandos Firebase/Google Cloud ou outra ação autenticada disponível ao operador via Cloud Shell — o agente deve:

1. identificar exatamente por que a intervenção é necessária;
2. evitar interromper o desenvolvimento por ações pequenas que possam ser postergadas com segurança;
3. preferir consolidar várias publicações/ações compatíveis em um único momento, idealmente após várias fases ou em um gate de release;
4. fornecer um bloco único de comandos Cloud Shell, pronto para copiar e executar;
5. solicitar ao operador apenas o retorno essencial do comando para validação;
6. nunca presumir que a publicação ocorreu sem confirmação do resultado.

Exceção: se a ação externa for requisito de segurança, bloqueio técnico ou condição indispensável para validar a fase atual, ela deve ser solicitada imediatamente, sem aguardar consolidação futura.

## Princípio de fonte da verdade

Quando houver divergência entre uma conversa antiga e estes arquivos:

- `DECISIONS.md` prevalece para decisões de arquitetura e produto;
- `ROADMAP.md` prevalece para sequência planejada;
- `STATUS.md` prevalece para estado de implementação;
- o GitHub/`main` prevalece para o estado efetivo do código.

## Escopo inicial

O módulo será desenvolvido e validado **primeiro somente na conta fundadora**. Usuários externos permanecem sem acesso às funcionalidades logísticas até o encerramento dos blocos DEP e autorização explícita para iniciar a expansão EXT.
