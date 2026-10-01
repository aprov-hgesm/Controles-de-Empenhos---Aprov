# EMPROVEX — Modus Operandi Oficial de Desenvolvimento

Data de adoção: **2026-10-01**  
Status: **NORMA OFICIAL DE ENGENHARIA DO REPOSITÓRIO**  
Aplicação: EMPROVEX e novos módulos/ciclos relevantes desenvolvidos neste repositório.

Este documento define **como o EMPROVEX deve ser desenvolvido, integrado, validado, certificado e liberado** quando o trabalho tiver complexidade suficiente para ser dividido em frentes.

Ele generaliza o método comprovado durante a Performance R3 e deve ser aplicado também a ciclos futuros, como SaaS, billing, onboarding, segurança/legal, operação, novos módulos, migrações e grandes refatorações.

Documentos complementares:
- `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`;
- documentação específica do programa/ciclo em execução.

---

## 1. Princípio central

O desenvolvimento de ciclos grandes **não deve ser tratado como uma sequência monolítica em um único chat ou branch** quando houver partes realmente independentes.

O padrão oficial é:

> **baseline e contratos comuns → decomposição e mapa de dependências → workers independentes em ondas paralelas → handoffs → integração semântica controlada → validação integrada técnica e de UX → certificação final → autorização explícita de release**

Paralelismo é usado para reduzir tempo de calendário **sem sacrificar consistência**.

Paralelismo não significa:
- vários chats editando a mesma área sem coordenação;
- merge automático de tudo que ficou verde;
- duplicação de implementação;
- cada worker resolvendo conflitos de outras frentes;
- publicação direta em `main`.

---

## 2. Quando usar o fluxo completo

O fluxo completo é obrigatório quando houver um ou mais destes sinais:

- trabalho pode ser dividido em dois ou mais domínios independentes;
- múltiplas branches/workers serão usadas;
- mudanças estruturais importantes;
- risco relevante de regressão cruzada;
- alteração de segurança, dados, billing, autenticação ou persistência;
- otimização sistêmica;
- migração;
- release comercial;
- integração de várias entregas antes de produção.

Mudanças pequenas, locais e de baixo risco podem usar fluxo simplificado em um único chat/branch.

Mesmo no fluxo simplificado permanecem obrigatórios:
- confirmar baseline;
- preservar contratos;
- testar;
- documentar quando a mudança for relevante;
- não publicar em produção sem a autorização exigida pelo ciclo.

---

## 3. Papéis oficiais

### 3.1 Usuário / Fundador / Product Owner

É a autoridade de produto.

Responsabilidades:
- define objetivo e prioridade;
- decide requisitos de negócio e UX;
- resolve dúvidas de produto;
- realiza validação humana quando necessária;
- autoriza explicitamente merge/release para produção quando o ciclo exigir.

O usuário não deve precisar coordenar manualmente detalhes de Git entre workers.

---

### 3.2 Coordenador / Integrador / Avaliador

É o responsável pela visão global do ciclo.

Responsabilidades:
- ler o estado real do repositório antes de planejar;
- congelar baseline e contratos comuns;
- decompor o trabalho em frentes;
- definir dependências e ondas;
- definir branches, base SHA e propriedade preferencial de arquivos;
- produzir prompts de ativação;
- manter o quadro de integração;
- receber handoffs;
- comparar worker/base e integradora/base;
- revisar métricas, testes e contratos;
- decidir APROVADA, DEVOLVIDA, BLOQUEADA, DISPENSADA ou INTEGRADA;
- resolver conflitos semanticamente;
- executar somente glue code/correções de integração quando necessário;
- conduzir a validação integrada;
- atualizar o Memorial Oficial;
- preparar a passagem para certificação.

O Coordenador **não deve competir com os workers** implementando silenciosamente o mesmo escopo em paralelo.

---

### 3.3 Worker / Chat Trabalhador

É dono de uma frente delimitada.

Cada worker recebe:
- objetivo;
- branch;
- base SHA;
- dependências;
- arquivos/domínio preferenciais;
- contratos obrigatórios;
- áreas proibidas;
- métrica de sucesso;
- gates mínimos;
- formato de handoff.

Responsabilidades:
- trabalhar apenas na própria fronteira;
- confirmar branch e base antes de editar;
- medir antes/depois quando aplicável;
- preservar contratos globais;
- testar a própria frente;
- registrar riscos;
- entregar handoff reproduzível.

Quando descobrir necessidade fora do escopo, o worker deve:
1. registrar evidência;
2. não invadir a outra frente;
3. reportar dependência/bloqueio;
4. devolver ao Coordenador.

---

### 3.4 Certificador / Fase de Certificação

A certificação final deve ser **logicamente separada da implementação**.

Preferência:
- chat/fase própria;
- estado integrado já congelado;
- nenhuma feature nova.

Responsabilidades:
- repetir gates críticos;
- confirmar métricas finais;
- validar segurança e recuperação;
- validar documentação;
- verificar que blockers da fase integrada foram resolvidos;
- produzir decisão de candidato a release.

A certificação não deve “consertar o produto enquanto certifica”, salvo correção mínima necessária e explicitamente registrada; se surgir problema material, o candidato volta à integração.

---

## 4. Artefatos mínimos de um ciclo grande

Antes de ativar workers, o ciclo deve possuir:

1. **Plano mestre**
   - objetivo;
   - fora de escopo;
   - contratos globais;
   - critérios de sucesso.

2. **Plano de execução paralela**
   - frentes;
   - ownership;
   - mapa de dependências;
   - ondas;
   - branches;
   - regras de integração.

3. **Quadro de integração**
   - estado vivo das frentes;
   - base/HEAD;
   - dependências;
   - decisão do Coordenador.

4. **Handoff do Coordenador**
   - estado compacto para troca de chat;
   - integrações já feitas;
   - conflitos resolvidos;
   - próximos passos.

5. **Memorial Oficial**
   - estado canônico do produto;
   - decisões consolidadas;
   - sequência atual.

Os nomes podem variar por programa, mas as funções acima devem existir.

---

## 5. Congelamento inicial: baseline e contratos

Nenhum ciclo paralelo deve começar apenas com uma ideia geral.

O Coordenador deve registrar:

- repositório;
- `main` real;
- branch integradora;
- HEAD/base comum;
- versões relevantes;
- módulos afetados;
- contratos funcionais;
- contratos de segurança;
- contratos de dados;
- contratos de UX;
- política de testes;
- métricas/baseline, quando aplicável;
- proibições;
- definição de pronto.

Contratos comuns devem ser tratados como imutáveis pelos workers, salvo autorização expressa do Coordenador.

---

## 6. Decomposição correta das frentes

Uma frente é boa candidata a paralelismo quando:

- possui objetivo próprio;
- pode ser medida/testada isoladamente;
- altera principalmente um domínio delimitado;
- tem interfaces claras com outras partes;
- pode entregar handoff sem depender de implementação interna de outra frente.

Não criar paralelismo artificial.

Se duas tarefas:
- alteram os mesmos arquivos centrais;
- dependem da mesma decisão ainda indefinida;
- ou precisam ser desenhadas conjuntamente,

elas devem ser:
- uma única frente;
- ou executadas em ondas dependentes.

---

## 7. Mapa de dependências e ondas

Classificar cada frente como:

- independente;
- dependente;
- opcional condicionada a evidência;
- integração;
- certificação.

Exemplo genérico:

```text
BASELINE + CONTRATOS
        |
  +-----+-----+
  |     |     |
  A     B     C       <- onda paralela
  |     |
  D     E             <- dependências específicas
   \   /
 INTEGRAÇÃO
     |
 VALIDAÇÃO UX
     |
 CERTIFICAÇÃO
     |
 RELEASE EXPLÍCITO
```

Uma frente dependente só é ativada quando sua condição estiver formalmente satisfeita.

---

## 8. Topologia oficial de branches

Padrão recomendado:

```text
main
└── feat/<programa-ou-release>
    ├── <programa>-a-...
    ├── <programa>-b-...
    ├── <programa>-c-...
    └── ...
```

Regras:

- `main` representa produto publicado/linha principal;
- branch integradora representa o candidato do ciclo;
- cada worker usa branch exclusiva;
- branch de validação temporária pode ser criada pelo Coordenador;
- worker nunca faz merge direto em `main`;
- worker não integra outra branch trabalhadora;
- release só ocorre a partir do estado integrado/certificado.

Branches temporárias de validação devem ser claramente nomeadas e não devem virar fonte de verdade.

---

## 9. Bases antigas e integradora que avançou

Quando um worker continua trabalhando sobre uma base antiga enquanto a integradora avança:

**não fazer merge/rebase apenas para deixar a branch “mergeable”.**

O protocolo oficial é:

1. identificar a base real do worker;
2. comparar **worker vs. base**;
3. comparar **integradora vs. mesma base**;
4. identificar sobreposição de arquivos e contratos;
5. separar mudanças exclusivas de conflitos reais;
6. preservar a solução do worker isoladamente;
7. deixar a reconciliação para o Coordenador.

Isso evita que um worker absorva acidentalmente responsabilidades e conflitos de outras frentes.

---

## 10. Handoff obrigatório do worker

O handoff deve conter, no mínimo:

- frente;
- branch;
- base SHA;
- HEAD final;
- status;
- objetivo executado;
- arquitetura/decisões;
- arquivos alterados;
- antes/depois;
- métricas, quando existirem;
- testes/gates;
- CI;
- segurança;
- riscos residuais;
- pendências;
- conflitos esperados;
- documentação atualizada;
- confirmação de que não houve ações proibidas.

Um commit sem handoff não encerra a frente.

Um CI verde sem revisão do Coordenador não integra a frente automaticamente.

---

## 11. Estados oficiais de uma frente

O quadro de integração deve usar estados explícitos.

Padrão:

- **LIVRE** — pode ser ativada;
- **EM ANDAMENTO** — worker ativo;
- **EM REVISÃO** — handoff entregue;
- **DEVOLVIDA** — requer correção;
- **BLOQUEADA** — dependência/decisão pendente;
- **APROVADA** — apta à integração;
- **INTEGRADA** — incorporada à integradora;
- **DISPENSADA** — evidência mostrou que não é necessária;
- **CERTIFICADA** — quando aplicável, passou pela certificação final específica.

Não usar “deu certo” como substituto de estado técnico.

---

## 12. Revisão do Coordenador

Ao receber uma frente, o Coordenador deve confirmar:

1. branch e HEAD;
2. base real;
3. ahead/behind;
4. arquivos alterados;
5. escopo;
6. testes;
7. CI;
8. contratos;
9. sobreposição com a integradora;
10. efeitos de UX;
11. segurança;
12. documentação.

A pergunta não é apenas:

> “os testes passaram?”

Também é:

> “essa solução continua correta quando combinada ao sistema atual?”

---

## 13. Integração semântica

Conflitos nunca devem ser resolvidos mecanicamente por preferência cega de:

- `ours`;
- `theirs`;
- “pegar o arquivo mais novo”.

O Coordenador deve entender o propósito das duas mudanças e combinar os contratos.

Padrão:

1. preservar o comportamento válido da integradora;
2. preservar o contrato válido do worker;
3. produzir árvore combinada;
4. adaptar glue code/guards quando necessário;
5. validar a combinação;
6. somente então avançar a integradora.

---

## 14. CI combinado é obrigatório quando houver risco cruzado

CI da branch trabalhadora prova apenas que a frente funciona no seu contexto.

Quando a integradora mudou ou há sobreposição relevante, o Coordenador deve validar o estado combinado.

Pode usar:
- PR técnico;
- merge virtual;
- branch temporária;
- outro mecanismo reproduzível que teste a árvore combinada real.

O log deve permitir provar quais SHAs foram combinados.

Não declarar integração segura apenas porque:
- CI do worker ficou verde;
- arquivos não tiveram conflito textual;
- Git informou `mergeable=true`.

---

## 15. Guards e falhas cruzadas

Quando um guard falhar:

### Falha própria da frente
Worker corrige.

### Guard estrutural desatualizado pela própria frente
Worker pode atualizar o guard sem enfraquecer sua semântica.

### Falha cruzada
Worker registra e devolve ao Coordenador.

O Coordenador resolve incompatibilidades produzidas pela combinação das frentes.

Nunca enfraquecer um guard apenas para obter verde.

---

## 16. Validação integrada

Depois das frentes necessárias estarem integradas, deve existir uma fase explícita de validação integrada.

Ela cobre:
- build;
- TypeScript;
- testes de domínio;
- segurança;
- isolamento;
- recuperação;
- métricas;
- custos/reads quando aplicável;
- regressões cruzadas;
- UX real;
- hardware/conectividade representativos quando relevante.

A validação integrada não é uma nova fase de features.

Correções permitidas:
- glue code;
- conflito;
- regressão objetiva;
- proteção de UX;
- ajuste de guard sem perda de contrato.

---

## 17. UX é gate de engenharia

A experiência do usuário não é uma checagem cosmética posterior.

Pode bloquear uma integração/release mesmo com CI verde.

Exemplos de blocker:
- perda de dado digitado;
- clique sem resposta;
- loading sem feedback;
- informação parcial apresentada como completa;
- estado/filtro inesperado;
- refresh manual novo;
- foco/ENTER/scanner quebrado;
- navegação menos previsível;
- piora relevante em máquina modesta.

Quando performance e UX entrarem em conflito, preservar clareza, previsibilidade e segurança operacional.

---

## 18. Certificação final

A certificação deve usar um candidato congelado.

Validar, conforme o ciclo:
- HEAD exato;
- build;
- TypeScript;
- diff hygiene;
- segurança;
- recovery;
- regras/dados;
- CI;
- métricas finais;
- budgets;
- experiência;
- documentação;
- pendências conhecidas.

Resultado possível:

- **CANDIDATO CERTIFICADO**;
- **BLOQUEADO / DEVOLVIDO**.

Certificação não autoriza produção por si só.

---

## 19. Release e produção

Regra geral:

> **worker não publica; integração não publica; certificação não publica automaticamente.**

Merge em `main`, promoção/deploy de produção ou outra ação irreversível depende da política do ciclo e, quando definido no Memorial/plano, de autorização explícita do usuário.

Evitar previews/deploys intermediários que não acrescentem evidência útil, especialmente quando houver limites de plataforma.

---

## 20. Documentação viva

O repositório, e não uma conversa isolada, é a fonte operacional de continuidade.

Atualizar nos marcos:
- ativação de onda relevante;
- integração;
- devolução material;
- mudança de dependência;
- validação integrada;
- certificação;
- release.

Evitar transformar o Memorial em diário de cada pequeno commit.

O Memorial deve guardar:
- estado;
- decisões;
- contratos;
- referências;
- sequência vigente.

Detalhes técnicos ficam nos documentos especializados.

---

## 21. Troca de Coordenador

Quando uma conversa ficar longa ou um Coordenador precisar ser substituído:

1. atualizar Memorial;
2. atualizar quadro de integração;
3. atualizar handoff do Coordenador;
4. registrar HEAD real;
5. listar frentes integradas/abertas;
6. listar blockers;
7. registrar próxima ação exata.

O novo Coordenador deve ler o repositório antes de confiar em qualquer resumo de conversa.

---

## 22. Escala do método

O método deve ser proporcional ao trabalho.

### Mudança pequena
- um chat;
- uma branch;
- testes focados;
- documentação mínima.

### Mudança média
- Coordenador + 1–3 workers;
- integração;
- CI combinado quando necessário.

### Programa grande
- Coordenador dedicado;
- várias frentes/ondas;
- quadro vivo;
- handoffs;
- integração semântica;
- validação integrada;
- certificação separada;
- release controlado.

Não abrir muitos chats por hábito. Abrir frentes quando houver independência real.

---

## 23. Anti-padrões proibidos

Evitar:

- worker alterando domínio de outro worker sem autorização;
- dois workers implementando a mesma coisa;
- branch sem base SHA conhecida;
- rebase automático só para “ficar atualizado”;
- merge direto de worker em `main`;
- resolver conflito com `ours/theirs` sem análise;
- declarar sucesso só por commit;
- declarar sucesso só por CI isolado;
- benchmark sintético apresentado como produção;
- otimização que degrada UX;
- documentação divergente do código por longos períodos;
- deploy usado como substituto de teste;
- Coordenador virando worker concorrente;
- certificador adicionando feature.

---

## 24. Template mínimo de ativação de worker

Todo prompt de worker deve conter:

```text
Frente:
Repositório:
Branch integradora:
Base SHA:
Branch exclusiva:

Objetivo:
Dentro do escopo:
Fora do escopo:
Contratos obrigatórios:
Arquivos preferenciais:
Dependências:
Métrica de sucesso:
Testes/gates:
Proibições:
Formato do handoff:
```

---

## 25. Template mínimo de handoff

```text
FRENTE — HANDOFF

Branch:
Base:
HEAD final:
Status:

Objetivo entregue:
Arquitetura:
Arquivos alterados:
Métricas:
Testes:
CI:
Segurança:
Riscos:
Pendências:
Conflitos esperados:
Documentação:

Confirmações de ações proibidas:
```

---

## 26. Critério de sucesso do modus operandi

O método está funcionando quando:

- workers podem avançar sem conhecer toda a implementação das outras frentes;
- nenhuma frente depende de memória informal de chat;
- conflitos ficam concentrados na integração;
- regressões cruzadas são detectadas antes de `main`;
- UX é validada no sistema combinado;
- certificação testa um candidato definido;
- o usuário toma decisões de produto/release sem precisar administrar Git manualmente;
- um novo Coordenador consegue retomar o trabalho apenas lendo o repositório.

---

## 27. Precedência

Este documento é a **regra geral de engenharia**.

Documentos de um programa específico podem acrescentar:
- nomes de branches;
- gates;
- contratos;
- exceções;
- dependências;
- critérios próprios.

Uma exceção ao modus operandi deve ser:
- explícita;
- justificada;
- documentada no plano do programa e no Memorial quando relevante.

Na ausência de exceção explícita, este documento prevalece como método padrão de desenvolvimento do EMPROVEX.
