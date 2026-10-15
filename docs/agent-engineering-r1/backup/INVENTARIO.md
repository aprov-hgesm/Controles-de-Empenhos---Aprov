# GOVERNANCE-BACKUP-01 — Inventário público do estado inicial

> **FATO OBSERVADO — 2026-10-14.** Inventário documental e de referências; **não é cópia de segurança integral**. Consulta GitHub REST não atômica, sujeita a mudanças concorrentes. Fonte: [repositório](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov).

## Estado observado
- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`; visibilidade: público (consulta de metadados).
- Base `main`: `97556bb8eb04af070016f9e58ddc2d9cca36bb35`.
- Branch de proteção lógica do RC: `rc-r1-global-frozen-2026-10-09@61e372225834ed6060cd2b36dbdd55d1e1979c2c`.
- Integradora SaaS: `feat/saas-r1-commercializacao@818c43dc4e85f01ba997717936efd1e749fe89ba`.
- Integradora Mobile: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238`.
- Refs de branches listadas: **307**; tags retornadas por `matching-refs/tags`: **0**.
- PRs abertos: **60**; DRAFT: **48**; não-DRAFT: **12**.
- Inventário integral dos SHAs observados de branches e de heads/bases dos PRs abertos: [`REFERENCIAS_PUBLICAS_2026-10-14.json`](./REFERENCIAS_PUBLICAS_2026-10-14.json).
- Foram lidas quatro páginas de `git/refs` com 100 itens cada. A página 4 já continha refs de PR; essas páginas cobrem as branches ordenadas alfabeticamente observadas no instante da consulta. **Não** se declara cobertura de todas as refs `refs/pull/*` históricas, nem restauração de qualquer objeto.
- No retorno de `GET /rulesets` não havia rulesets. A leitura de branch protection clássica não pôde ser concluída sob a permissão do conector; portanto não há prova de ausência de proteção.

## Refs críticas
| Referência | SHA observado |
|---|---|
| `main` | `97556bb8eb04af070016f9e58ddc2d9cca36bb35` |
| `rc-r1-global-frozen-2026-10-09` | `61e372225834ed6060cd2b36dbdd55d1e1979c2c` |
| `rc-r1-global-certification-01` | `61e372225834ed6060cd2b36dbdd55d1e1979c2c` |
| `rc-r1-composition-01` | `fae9ce6aed7242e85d53fc8e6470fba4425a8c27` |
| `rc-r1-warehouse-full-integration-01` | `dec21b86cbbafbb2d7f3d50bd7b9af3371abc740` |
| `rc-r1-preview-firebase-isolation-01` | `78dc23bb460059a83bd9ab3b18964bbe1a051222` |
| `feat/saas-r1-commercializacao` | `818c43dc4e85f01ba997717936efd1e749fe89ba` |
| `feat/central-mobile-r1` | `7b7717b6eebabf911310d2b8ac56ed13c9cb9238` |
| `mobile-r1-k-canonical-ops-engine` | `9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0` |
| `saas-final-audit-01` | `4cc5b3797747d4d49591f4a68196e723700daa74` |
| `visual-r1-integration-01` | `08b494e1a4079d271f9604a7f15e41d39619aa46` |
| `visual-w1-orb-core-01` | `05bd152f798b3fba4df367b87ed3b0f29b788265` |
| `visual-w2-loaders-01` | `670a77bcffa0d2fcf746d5b0a4bda181380b0d54` |
| `visual-w3-motion-01` | `fc26033297bb8b637a1a8461793fb37eb7d4c603` |
| `visual-w4-border-beam-01` | `8237e52bbd75a642d0208eedd7fb58e24807164f` |

## Documentos e contratos localizados na `main`
 - `docs/EMPROVEX_MEMORIAL_OFICIAL.md`
 - `docs/EMPROVEX_PROGRAM_CONTROL.md`
 - `docs/DEVELOPMENT_CI_WORKFLOW.md`
 - `docs/TESTING_POLICY.md`
 - `docs/EMPROVEX_CORE_PROTECTION.md`
 - `docs/BACKUP_RECOVERY.md`
 - `docs/RECUPERACAO_FIRESTORE.md`
 - `docs/SAAS_R1_INTEGRATION_STATUS.md`
 - `docs/SAAS_R1_COORDENADOR_HANDOFF.md`
 - `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
 - `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`
 - `docs/RC_R1_COMPOSITION_01.md`
 - `docs/RULES_COMPAT_01_AUDIT.md`

O diretório `docs/` teve **157 itens** na listagem de primeiro nível. Os documentos abaixo podem ter revisões posteriores em branches fora da `main`. O Memorial consultado na `main` declara última sincronização global de 2026-10-04; **não** equivale ao estado vivo das frentes de 14/10. O Program Control é a camada coordenadora; os documentos de status/handoff contêm detalhes especializados.

## Gates e workflows observados
- `.github/workflows/application-ci.yml`
- `.github/workflows/browser-e2e-on-demand.yml`
- `.github/workflows/emprovex-core-protection.yml`
- `.github/workflows/recovery-guardrails.yml`
- `.github/workflows/saas-c-browser-validation.yml`
- `.github/workflows/saas-dl-legal.yml`

Os arquivos de workflows foram somente listados; **nenhum CI foi executado ou reinterpretado** neste worker.

## Lacunas / limites
1. Um SHA de branch ou de PR documenta uma referência lógica, **não preserva** objetos Git em uma infraestrutura independente.
2. PRs abertos incluem código fora de `main`; não assumir que um clone restrito à `main` os cubra.
3. Comentários, reviews, approvals, checks, issues, configurações de proteção, permissões, secrets, ambientes, deployments e settings não são exportados pelo bundle Git.
4. Firestore operacional, bancos, Storage e dados reais **fora do escopo** deste worker; `docs/RECUPERACAO_FIRESTORE.md` e `docs/BACKUP_RECOVERY.md` são documentação, não uma exportação de dados.
5. Faltou acesso de rede Git no ambiente de execução para `git clone --mirror` (falha de resolução DNS de `github.com`). Sem bundle verificável e cópia externa independente.
6. A listagem REST não é snapshot atômico: os SHAs podem ter mudado durante a consulta. Revalidar antes da cópia externa.

## Classificação
**PASS COM PENDÊNCIAS na documentação e inventário; BLOCKED na certificação de backup recuperável externo.** Nenhum restore real ou SHA-256 de bundle foi executado.

## Segurança e ownership
Mudanças limitadas a `docs/agent-engineering-r1/backup/` nesta branch exclusiva. `main`, RC, Rules, produção e dados reais não são parte das gravações autorizadas.