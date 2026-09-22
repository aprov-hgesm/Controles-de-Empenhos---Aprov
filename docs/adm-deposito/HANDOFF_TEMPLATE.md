# ADM Depósito — Template de Continuidade entre Chats

Use esta mensagem como ponto de partida para cada nova fase do módulo ADM Depósito.

```text
Quero continuar o desenvolvimento do Módulo ADM Depósito / Área Logística do EMPROVEX exatamente de onde a fase anterior terminou.

Repositório:
aprov-hgesm/Controles-de-Empenhos---Aprov

Antes de alterar qualquer código:

1. Confira o estado real da branch main no GitHub.
2. Leia:
   - docs/adm-deposito/README.md
   - docs/adm-deposito/ROADMAP.md
   - docs/adm-deposito/DECISIONS.md
   - docs/adm-deposito/STATUS.md
3. Compare a main atual com o último commit de referência registrado no STATUS.md.
4. Se houver commits posteriores, analise se interferem na fase atual.
5. Não altere decisões congeladas em DECISIONS.md sem registrar a nova decisão.
6. Não avance para a fase seguinte automaticamente.

Neste chat, desenvolva exclusivamente:

FASE [NÚMERO] — [NOME]
Blocos: [DEP-X, DEP-X.1...]

Regras:
- preserve todas as funcionalidades atuais do EMPROVEX;
- mantenha o módulo logístico disponível somente para a conta fundadora durante o piloto;
- use branch própria;
- execute os testes adequados;
- abra PR;
- valide checks;
- faça merge na main somente após aprovação técnica;
- verifique o deploy quando aplicável;
- trabalhe de forma autônoma e evite intervenção manual do operador sempre que houver integração disponível;
- quando Cloud Shell for realmente necessário, prefira consolidar publicações/ações compatíveis em um único bloco após várias fases ou no gate de release;
- se uma intervenção externa for indispensável para segurança ou validação da fase atual, solicite-a imediatamente e forneça comandos prontos para copiar;
- nunca presuma que uma publicação externa ocorreu sem validar o retorno do operador;
- ao concluir, atualize STATUS.md com PR, commit, testes, riscos, pendências e próxima fase;
- atualize DECISIONS.md somente se houver nova decisão arquitetural definitiva;
- não inicie a próxima fase neste mesmo chat.
```

## Regra de uso

O template ajuda a iniciar a conversa, mas a fonte da verdade continua sendo o repositório.

Se o texto colado no chat divergir dos arquivos desta pasta, os arquivos oficiais e a `main` atual prevalecem.
