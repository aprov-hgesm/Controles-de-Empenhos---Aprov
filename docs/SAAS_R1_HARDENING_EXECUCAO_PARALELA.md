# EMPROVEX SaaS R1 — Execução Paralela do Hardening Pré-Piloto

Data: **2026-10-02**

Programa: **HARDENING PRÉ-PILOTO**

Integradora: `feat/saas-r1-commercializacao`

> Este documento complementa o Memorial Oficial. O Memorial permanece a autoridade global. Em conflito, prevalece a decisão coordenadora mais recente registrada no Memorial.

## 1. Objetivo da onda

Fechar tudo que ainda impede congelar um **Release Candidate SaaS R1** tecnicamente apto a ser publicado em uma janela controlada e, somente depois, submetido ao piloto real final.

A onda **não** executa o piloto real.

## 2. Topologia

Máximo simultâneo:
- 1 Chat Coordenador;
- 4 workers independentes.

Workers:
- HARDEN-A — Segurança, Dependências, CI e Regressão;
- HARDEN-B — Backup, Recovery e Restore;
- HARDEN-C — Health, Rules, Release e Rollback;
- HARDEN-D — Reconciliação SaaS ↔ MOBILE-R1 e Evidências.

Todos partem do mesmo HEAD congelado, definido pelo Coordenador após a documentação de preparação.

## 3. Regras comuns

Cada worker:
1. confirma branch e HEAD antes de editar;
2. não recria branch;
3. não faz rebase/merge da integradora;
4. não incorpora outra worker;
5. trabalha somente no seu escopo;
6. não faz merge em `main`;
7. não publica Vercel;
8. não publica Rules;
9. não executa restore real;
10. não cria cliente/P-03;
11. não executa piloto J01–J20;
12. não altera P-01/P-02;
13. não usa `npm audit fix --force`;
14. classifica qualquer colisão transversal e devolve ao Coordenador;
15. entrega handoff auditável.

Mudança compartilhada deve conter seção **Impacto MOBILE-R1**.

## 4. Matriz de propriedade

| Domínio | A | B | C | D |
|---|---:|---:|---:|---:|
| `package.json` / lockfile | DONO | leitura | leitura | leitura |
| dependências/CVEs | DONO | leitura | leitura | leitura |
| scripts de CI/guards de segurança | DONO | leitura | leitura | leitura |
| recovery scripts/tests | leitura | DONO | leitura | leitura |
| estado externo backup/PITR/restore | — | DONO | leitura | evidência |
| `/api/health` e teste health | leitura | — | DONO | leitura |
| pacote Rules / ordem rollout | leitura | leitura | DONO | AUDITA |
| Vercel/release/rollback | leitura | — | DONO | evidência |
| comparação SaaS↔Mobile | impacto | impacto | impacto | DONO |
| arquivos runtime compartilhados | não alterar fora do escopo | não alterar fora do escopo | somente os atribuídos | **não alterar por padrão** |
| Memorial/Integration Status global | — | — | — | — |
| integração/freeze RC | COORD. | COORD. | COORD. | COORD. |

HARDEN-D é **auditivo por padrão**. Se detectar correção funcional necessária em Auth, sessão, Rules, lifecycle, shell, Central, schema ou contrato compartilhado, não deve editar o runtime: registra o conflito e devolve ao Coordenador para uma branch curta `saas-harden-fix-<dominio>-<slug>`.

## 5. HARDEN-A — Segurança, Dependências, CI e Regressão

Branch planejada:
`saas-harden-a-security-dependencies`

Missão:
- explicar os 22 advisories observados no `npm ci`;
- identificar pacote, versão, cadeia de dependência, severidade, runtime/dev e exposição real;
- diferenciar alerta transitivo de vulnerabilidade alcançável pelo EMPROVEX;
- determinar correção mínima compatível;
- aplicar somente upgrades controlados quando necessários e seguros;
- certificar regressão técnica após qualquer alteração.

Obrigatório:
- `npm audit`/inspeção equivalente sem `--force`;
- registrar antes/depois;
- TypeScript;
- production build;
- Diff Hygiene;
- Application CI equivalente disponível;
- Core Protection;
- Recovery guardrails;
- Legal Validation/guards relevantes;
- guards de segurança/multitenancy afetados;
- revisar bundle/lockfile somente se mudança ocorrer.

Proibido:
- upgrade major oportunista;
- refatoração estética;
- alterar billing/lifecycle/onboarding para “aproveitar” a onda;
- mascarar advisory;
- declarar seguro apenas porque `npm audit fix` sugere solução.

PASS:
- advisories classificados;
- vulnerabilidades relevantes corrigidas ou justificadamente aceitas com evidência;
- nenhum blocker alto/crítico alcançável sem decisão explícita;
- gates pós-correção verdes.

Entregáveis:
- relatório de triagem;
- diff mínimo, se necessário;
- lista de advisories remanescentes e justificativa;
- comandos/resultados;
- handoff.

## 6. HARDEN-B — Backup, Recovery e Restore

Branch planejada:
`saas-harden-b-recovery-restore`

Missão:
- fechar J24 antes do piloto real.

Estado herdado:
- PITR ativo nos dois bancos;
- delete protection ativa;
- schedule diário ativo;
- retenção 14 semanas;
- não repetir `apply`.

Obrigatório:
- `recovery:status`;
- `recovery:verify`;
- confirmar backup READY nos dois bancos;
- registrar resource name/location/snapshot/expiração;
- selecionar backup real;
- preparar restore-plan para database **novo e isolado**;
- validar que target não é produção;
- documentar checklist IAM/Rules/TTL/amostragem.

Restore real:
- **não executar sem autorização explícita do fundador**;
- se autorizado, acompanhar operação e validar amostra de dados;
- nunca restaurar sobre banco produtivo;
- não remover delete protection de produção.

PASS:
- backup READY em ambos;
- verify verde;
- restore isolado real concluído e validado;
- IAM/Rules/TTL do target conferidos;
- evidência completa.

PARCIAL:
- tudo pronto, mas restore aguardando autorização/evento externo.

## 7. HARDEN-C — Health, Rules, Release e Rollback

Branch planejada:
`saas-harden-c-release-health-rules`

Missão:
montar o pacote exato que permitirá publicar o RC de forma controlada.

Responsabilidades:
- auditar PR #223/health contra a base congelada;
- integrar semanticamente o endpoint health na própria branch se continuar correto;
- garantir 200 + `status=ok`, `no-store`, zero Firestore/secrets;
- testar health;
- levantar todas as Rules necessárias para o candidato SaaS R1;
- comparar Rules atuais de produção versus candidatas;
- definir ordem exata de rollout;
- definir smoke e rollback;
- listar env/config necessárias;
- preparar estratégia Vercel considerando `build-rate-limit`;
- preparar, mas não criar, uptime/alert/channel antes da publicação quando dependerem do endpoint vivo.

Não fazer:
- publicação real;
- promoção `main`;
- deploy Rules;
- alterar domínio comercial/lifecycle para resolver conflito;
- merge cego do PR #223.

PASS:
- health integrado/testado no candidato;
- manifest de release completo;
- Rules candidatas identificadas e validadas;
- ordem rollout/rollback reproduzível;
- smoke checklist pronta;
- nenhuma dependência oculta de publicação.

## 8. HARDEN-D — Reconciliação SaaS ↔ MOBILE-R1 e Evidências

Branch planejada:
`saas-harden-d-mobile-reconciliation`

Missão:
garantir que o Release Candidate SaaS não invalide a MOBILE-R1 e que a Mobile não tenha introduzido mudança compartilhada incompatível.

Snapshot inicial deve registrar:
- HEAD SaaS congelado;
- HEAD vivo da `feat/central-mobile-r1`;
- branches/PRs Mobile relevantes.

Comparar semanticamente:
- Auth;
- workspace/UG;
- sessão/lease/heartbeat;
- legal gate;
- billing/lifecycle;
- `warehouseAccess`;
- Firestore Rules;
- schema/source of truth da Central;
- shell/guards;
- contratos desktop/mobile;
- `next.config.ts`/Permissions-Policy quando relevante;
- APIs/serviços compartilhados.

Por padrão:
- **não editar runtime**;
- produzir matriz `SEM DELTA / DELTA COMPATÍVEL / CONFLITO / REQUER COORDENADOR`;
- identificar commits/arquivos dos dois lados;
- recomendar ordem de incorporação.

Se houver conflito concreto:
- não resolver dentro de HARDEN-D;
- abrir incidente de integração;
- devolver ao Coordenador para branch curta específica.

PASS:
- todos os domínios compartilhados classificados;
- nenhum conflito material aberto;
- Mobile Impact do RC explicitado;
- matriz de evidência pronta para freeze.

## 9. Handoff obrigatório

Todo worker entrega:

- Frente:
- Branch:
- Base congelada:
- HEAD final:
- PR draft:
- Status: PASS / PARCIAL / BLOQUEADO;
- Arquivos alterados:
- Diff resumido:
- O que foi confirmado:
- O que foi alterado:
- O que **não** foi executado:
- Comandos/testes e resultados:
- Incidentes:
- Riscos/pêndencias:
- Impacto MOBILE-R1:
- Dependência de autorização externa:
- Recomendação ao Coordenador:
- Critério objetivo para próxima etapa.

Nenhum worker pode escrever “deu certo” sem ligar a conclusão a evidência concreta.

## 10. Integração coordenada

O Coordenador:
1. audita HEAD/PR/diff de cada worker;
2. não confia apenas no texto do handoff;
3. decide merge, integração semântica ou devolução;
4. resolve sobreposição de arquivos;
5. atualiza Memorial/Status/Handoff;
6. repete gates combinados quando necessário;
7. consulta Mobile viva novamente;
8. congela o RC apenas quando todos os gates materiais estiverem fechados.

Ordem lógica de fechamento:
- receber D cedo para identificar conflitos;
- integrar A quando houver correção de dependência;
- fechar B quando recovery permitir;
- integrar C após reconciliar dependências/release;
- fazer certificação combinada;
- congelar RC.

A ordem de integração pode mudar por dependências reais; não usar cronologia como substituto de análise.

## 11. Gate de freeze do Release Candidate

O Coordenador só registra `RC FROZEN` quando:
- HARDEN-A sem blocker relevante;
- HARDEN-B PASS;
- HARDEN-C PASS;
- HARDEN-D PASS;
- CI/build/typecheck/diff hygiene verdes;
- Core/Recovery/Legal e segurança aplicável verdes;
- Rules/rollout/rollback definidos;
- backup/restore real comprovados;
- Mobile reconciliada;
- nenhum incidente pré-piloto bloqueante;
- HEAD único da integradora registrado.

Depois disso, e somente depois de autorização explícita, preparar/publicar o RC para smoke e piloto final.

## 12. Program Control — liberação específica da HARDEN-D

A HARDEN-D foi formalmente liberada após estabilização da MOBILE-R1.

Alvos:
- Mobile: `7b745fa0b7979e643b83b7de94dd96a0290930ab`;
- SaaS vivo/contexto: `4848643be85b30532f7f093c4ddb0e729facfad3`;
- base worker: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`.

Delta inicial obrigatório:
- `next.config.ts`;
- Mobile permite `camera=(self)`;
- SaaS atualmente bloqueia `camera=()`;
- microfone e geolocalização permanecem bloqueados em ambos.

A worker deve:
1. demonstrar o requisito funcional da câmera same-origin da Central Móvel;
2. classificar o delta semanticamente;
3. não editar runtime por padrão;
4. devolver conflito ao Coordenador se a solução exigir mudança compartilhada;
5. revisar todos os demais contratos previstos na seção HARDEN-D;
6. produzir matriz completa.

MOBILE-F/G/H ficam fora da janela até o handoff D.
