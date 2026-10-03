# EMPROVEX — Program Control / Coordenador Geral

Data de instituição: **2026-10-02**

Estado: **ARQUITETURA OFICIAL APROVADA / CHAT COORDENADOR GERAL AINDA NÃO ATIVADO**

## 1. Finalidade

O Coordenador Geral do EMPROVEX é a camada de governança acima dos Coordenadores de Programa.

Seu objetivo é preservar:
- coerência global;
- eficiência do desenvolvimento paralelo;
- integração segura entre programas;
- rastreabilidade de decisões;
- controle de WIP;
- integridade do Memorial Oficial;
- preparação correta de Release Candidates e releases.

Ele **não é um worker** e **não substitui os Coordenadores de Programa**.

## 2. Hierarquia oficial

```text
FUNDADOR
   │
COORDENADOR GERAL EMPROVEX
   │
   ├── COORDENADOR MOBILE-R1
   │      └── workers MOBILE
   │
   └── COORDENADOR SAAS-R1
          └── workers SAAS/HARDEN
```

Regra:
- workers reportam ao Coordenador de Programa;
- Coordenadores de Programa reportam estado consolidado ao Coordenador Geral;
- o Coordenador Geral intervém diretamente em worker apenas por exceção coordenada.

Não criar camada acima do Coordenador Geral. A hierarquia máxima oficial é:
**Fundador → Coordenador Geral → Coordenadores de Programa → Workers**.

## 3. Autoridade do Fundador

Continuam exclusivas do fundador, quando aplicável:
- autorização de publicação produtiva;
- merge/release final quando explicitamente protegido;
- deploy/promoção Vercel produtiva;
- publicação de Rules produtivas;
- restore real quando exigir autorização;
- ações disruptivas sobre usuários/workspaces reais;
- decisão GO/NO-GO de Release Candidate e lançamento;
- alteração de contratos comerciais fundamentais quando não delegada.

O Coordenador Geral prepara a decisão; não substitui a autorização humana.

## 4. Responsabilidades exclusivas do Coordenador Geral

### 4.1 Estado global
Manter visão viva de:
- `main`/produção;
- integradora SaaS;
- integradora Mobile;
- bases congeladas;
- workers ativos;
- workers aguardando handoff;
- PRs relevantes;
- conflitos compartilhados;
- blockers;
- último ponto de reconciliação;
- próximo gate;
- estado do Release Candidate;
- autorização de produção.

### 4.2 Controle de concorrência e WIP
Decidir:
- quantos workers podem ficar ativos simultaneamente;
- quais frentes podem coexistir sem colisão;
- quais devem aguardar uma barreira de sincronização;
- quando não abrir uma nova onda porque a capacidade de revisão está saturada.

Princípio:
> **A capacidade de revisão determina o paralelismo; a capacidade de abrir chats não.**

Se handoffs se acumularem sem auditoria, não abrir nova onda.

### 4.3 Integração transversal
Arbitrar qualquer delta que atravesse mais de um programa, especialmente:
- Auth;
- workspace/UG;
- sessão/lease/heartbeat;
- legal gate;
- billing/lifecycle;
- Firestore Rules;
- `warehouseAccess`;
- Central de Depósitos;
- schemas/source of truth;
- shell/guards;
- APIs/serviços compartilhados;
- `next.config.ts` / políticas de navegador quando compartilhadas;
- telemetria/monitoramento com impacto comum.

### 4.4 Release management
Somente o Coordenador Geral pode declarar, no nível global:
- `PROGRAMAS RECONCILIADOS`;
- `EMPROVEX RC CANDIDATO`;
- `RC FROZEN`;
- `PRONTO PARA SOLICITAR PUBLICAÇÃO CONTROLADA`;
- `PRONTO PARA PILOTO`;
- `PRONTO PARA CERTIFICAÇÃO FINAL`.

Coordenadores de Programa podem declarar seu programa PASS, mas não declarar sozinhos o EMPROVEX globalmente pronto.

### 4.5 Governança documental
O Memorial Oficial passa a ter **propriedade lógica do Coordenador Geral**.

Isso significa:
- preservar coerência entre estado atual e histórico;
- manter o topo do Memorial representando sempre o estado vivo;
- marcar checkpoints antigos como históricos/superados quando necessário;
- evitar que decisões antigas pareçam vigentes;
- consolidar deltas certificados enviados pelos Coordenadores de Programa;
- impedir edição concorrente desnecessária das seções globais;
- conduzir auditorias periódicas de contradição;
- liderar futura reorganização documental/Memorial V2.

## 5. Responsabilidades dos Coordenadores de Programa

Cada Coordenador de Programa continua responsável por:
- planejamento de suas ondas;
- congelamento de bases;
- criação/ativação de workers;
- revisão real de HEAD/PR/diff;
- gates e testes do programa;
- devolução de workers;
- integração semântica/local;
- documentos especializados do programa;
- produção de um estado consolidado para o Coordenador Geral.

Não escalar detalhe local que possa ser resolvido no programa.

## 6. Responsabilidades dos Workers

Workers:
- executam somente a missão atribuída;
- usam branch/base congelada;
- não coordenam outras frentes;
- não alteram contratos compartilhados silenciosamente;
- produzem handoff reproduzível;
- informam Impacto Transversal / Impacto MOBILE-R1 ou equivalente;
- escalam ao Coordenador de Programa.

Workers não atualizam por padrão o estado global do Memorial.

## 7. Fluxo de informação

Fluxo normal:

```text
WORKER
  ↓ handoff + evidência
COORDENADOR DO PROGRAMA
  ↓ auditoria + integração + estado consolidado
COORDENADOR GERAL
  ↓ reconciliação global + Memorial + próximo gate
FUNDADOR
  ↓ decisões/autorizações quando necessárias
```

Evitar:
- worker → Coordenador Geral para rotina;
- worker → outro worker para combinar merge;
- Coordenador de Programa decidir isoladamente contrato compartilhado;
- múltiplos chats editarem simultaneamente a mesma seção global do Memorial.

## 8. Pacote mínimo de estado que cada Coordenador envia ao Geral

O relatório consolidado deve conter:
- Programa;
- Integrador + HEAD;
- Base(s) congelada(s);
- Workers ativos;
- Workers concluídos;
- Handoffs pendentes de revisão;
- PRs relevantes;
- Gates PASS/PARCIAL/BLOQUEADO;
- Deltas em contratos compartilhados;
- Incidentes;
- Risco atual;
- Próximo gate;
- Produção alterada? SIM/NÃO;
- Autorização externa necessária?;
- Recomendação objetiva.

O Coordenador Geral não deve precisar ler logs brutos para descobrir o estado normal do programa.

## 9. Classificação de problemas

### LOCAL
Afeta apenas uma worker.
Responsável: worker.

### DE PROGRAMA
Afeta múltiplas frentes do mesmo programa.
Responsável: Coordenador do Programa.

### TRANSVERSAL
Afeta SaaS + Mobile ou contrato comum.
Responsável: Coordenador Geral.

### RELEASE / PRODUÇÃO
Afeta `main`, Vercel, Rules produtivas, restore, usuários reais, dados ou lançamento.
Responsável: Coordenador Geral + autorização do Fundador quando aplicável.

## 10. Semáforo global

Cada programa/frente relevante pode receber:

### VERDE
Pode continuar independentemente.

### AMARELO
Há delta compartilhado/risco conhecido, mas o trabalho local pode continuar até o próximo gate.

### VERMELHO
Continuar naquela frente específica criaria risco, retrabalho material ou perda de segurança. Deve aguardar resolução.

O vermelho deve ser aplicado **à menor unidade necessária**, evitando bloquear programas inteiros sem motivo.

## 11. Barreiras de sincronização

Não sincronizar todas as branches continuamente.

Sincronizações globais devem ocorrer em pontos deliberados:
1. antes de abrir uma nova onda relevante;
2. após receber um conjunto de handoffs;
3. antes de iniciar uma frente explicitamente transversal;
4. antes de freeze de RC;
5. antes de publicação controlada;
6. após o piloto;
7. antes da certificação/release final.

Entre barreiras, programas podem avançar de forma independente quando VERDE.

## 12. Política de contratos compartilhados

Toda alteração que toque domínio compartilhado deve declarar:
- arquivos afetados;
- contrato anterior;
- contrato novo;
- compatibilidade;
- impacto no outro programa;
- migração/backward compatibility;
- necessidade de reconciliação.

Classificação:
- `SEM DELTA`;
- `DELTA COMPATÍVEL`;
- `CONFLITO`;
- `REQUER COORDENADOR GERAL`.

Nenhum conflito compartilhado deve ser resolvido por merge/rebase cego.

## 13. Política do Memorial Oficial

### 13.1 Propriedade lógica
O Coordenador Geral é o guardião do Memorial.

### 13.2 Quem pode alterar
- Coordenador Geral: estado global, governança, decisões transversais, releases e índice mestre;
- Coordenador de Programa: pode alterar seção global somente quando explicitamente autorizado ou quando o protocolo vigente assim determinar;
- workers: documentação da própria frente; não editar estado global por padrão.

### 13.3 Estado atual versus histórico
O Memorial deve diferenciar:
- **ESTADO VIGENTE**;
- **DECISÃO PERMANENTE**;
- **CHECKPOINT HISTÓRICO**;
- **DETALHE DE PROGRAMA**.

Quando uma decisão mudar:
- não apagar o histórico necessário;
- marcar a regra anterior como histórica/superada;
- criar regra vigente inequívoca;
- atualizar o topo/índice quando necessário.

### 13.4 Auditoria de coerência
Em cada grande barreira, verificar frases potencialmente contraditórias:
- EM EXECUÇÃO vs ADIADO;
- PUBLICADO vs NÃO PUBLICADO;
- PASS vs PENDENTE;
- branch/HEAD antigo;
- regra revogada ainda descrita como vigente.

### 13.5 Memorial V2
A reorganização estrutural futura do Memorial será conduzida pelo Coordenador Geral.

Estratégia:
- durante ondas críticas, não mover grandes seções;
- preparar inventário e arquitetura em paralelo se útil;
- executar migração estrutural em uma barreira de sincronização;
- preservar todo histórico em documentos especializados/arquivo;
- manter o Memorial principal menor, atual e navegável.

## 14. Registro Global do EMPROVEX

O Coordenador Geral deve manter um estado operacional compacto contendo, no mínimo:
- produção + HEAD;
- SaaS integradora + HEAD;
- Mobile integradora + HEAD;
- workers ativos;
- bases congeladas;
- semáforo por programa;
- conflitos transversais;
- blockers;
- último sync;
- próximo sync;
- próximo gate;
- RC;
- autorização de produção.

Esse registro serve como painel de controle. O Memorial continua sendo a memória institucional/constitucional.

## 15. Política de revisão antes de nova onda

Antes de abrir novos workers, o Coordenador Geral verifica:
- existem handoffs sem revisão?
- existe conflito transversal não classificado?
- coordenadores conseguem absorver novos resultados?
- a base congelada está correta?
- o novo paralelismo reduz tempo ou só aumenta WIP?
- há risco de auditar alvo em movimento?

Se a revisão estiver saturada, segurar nova onda.

## 16. Relação com a onda HARDEN e MOBILE-R1

No estado atual:
- MOBILE-R1 possui desenvolvimento paralelo em curso;
- SaaS R1 está em hardening pré-piloto;
- as branches HARDEN foram preparadas em base congelada;
- HARDEN-D é explicitamente transversal e deve reconciliar um estado Mobile suficientemente estável;
- o Coordenador Geral deve decidir a barreira correta para essa reconciliação, evitando auditar indefinidamente um alvo em movimento.

A existência de dois programas paralelos é precisamente o gatilho para instituir Program Control.

## 17. Critério para ativação do Coordenador Geral

Ao abrir o chat Coordenador Geral, ele deve:
1. ler `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. ler este documento;
3. ler os handoffs/estado corrente dos Coordenadores SaaS e Mobile;
4. consultar HEADs vivos das duas integradoras;
5. construir o primeiro Registro Global;
6. classificar semáforo de cada programa;
7. não editar código funcional;
8. não assumir workers;
9. não publicar nada;
10. emitir a próxima barreira/gate global.

## 18. Princípio de eficiência

O Coordenador Geral existe para **reduzir coordenação acidental**, não para aumentá-la.

Ele deve:
- receber síntese em vez de logs;
- intervir por exceção;
- bloquear somente o necessário;
- preferir reconciliações em barreiras;
- manter workers produtivos quando não há conflito;
- impedir WIP acima da capacidade de revisão;
- transformar contexto disperso em estado global pequeno e confiável.

## 19. Governança viva em branches congeladas

Branches congeladas não devem ser atualizadas apenas para receber novas regras documentais.

Quando Program Control/Memorial avançarem depois do freeze:
- preservar o HEAD da worker;
- transmitir no prompt o delta normativo relevante;
- permitir consulta somente leitura à cópia canônica da integradora;
- nunca usar atualização documental como justificativa para rebase/merge automático.

Consulta recomendada:

```powershell
git fetch origin
git show origin/feat/saas-r1-commercializacao:docs/EMPROVEX_MEMORIAL_OFICIAL.md
git show origin/feat/saas-r1-commercializacao:docs/EMPROVEX_PROGRAM_CONTROL.md
```

O Coordenador de Programa é responsável por garantir que o worker conheça regras globais publicadas após sua base congelada.

