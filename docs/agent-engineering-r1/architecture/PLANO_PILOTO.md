# AGENT-ARCHITECTURE-01 — Piloto, evolução e reversibilidade

**Objetivo:** demonstrar ganho de clareza e rastreabilidade sem alterar código, CI, governança canônica ou produção.

## Piloto recomendado — uma frente documental

### Etapa P0: homologação documental (sem promoção)
- W5 e Coordenador Geral comparam estes artefatos com Program Control, TESTING_POLICY e ownerships ativos.
- W4 avalia somente sugestões de métricas/gates, sem receber permissão implícita para editar workflows.
- Resolvem divergências sobre E2E e estado do Memorial em procedimento separado. Nenhum merge por presunção.
- Decisão registrada: aceitar, ajustar ou rejeitar cada wrapper; manter branch DRAFT até despacho.

### Etapa P1: ensaio em missão isolada
- Escolher uma tarefa **somente de documentação**, preferencialmente inventário de scripts/contratos de uma área pequena.
- Uma execução com contexto canônico selecionado e até duas skills adaptadas; comparação por revisão humana da qualidade do handoff, sem mexer em produto.
- Critérios: links/SHA corretos, ausência de pressupostos não verificados, menos retrabalho e 100% dos arquivos dentro do ownership; nenhuma alegação PASS sem evidência.
- Não medir “melhora” por número de linhas produzidas ou velocidade imaginada; registrar diferenças verificáveis.

### Etapa P2: revisão independente
- Revisor designado pelo Coordenador Geral confronta original, código e resultado.
- Checar injection, comandos automáticos, licenças, regressão de políticas e falso sentimento de autonomia.
- Se não houver revisor independente disponível: classificar **PASS COM PENDÊNCIA DE REVISÃO**, não promover.

### Etapa P3: decisão reversível
- Somente após aprovação, avaliar promover **uma** versão curta de AGENTS.md e skills selecionadas para locais compatíveis com os agentes reais.
- Toda alteração em raiz, CI, scripts, workflows ou configuração de agente exige missão/ownership novos e autorização correspondente.
- Rollback: retirar a versão promovida por PR específico com histórico preservado; nenhuma dependência funcional deve exigir essas skills.

## Governança de fontes externas

1. Registrar fornecedor, URL, SHA integral, data, licença e arquivos analisados para **cada atualização proposta**.
2. Comparar diffs do SHA anterior ao SHA novo; avaliar mudanças em comandos shell, permissões, fontes remotas, delegação, thresholds, criação de agentes e hooks automáticos.
3. Nunca acompanhar automaticamente main externo, instalar com npx ou atualizar plugins sem inspeção e aprovação.
4. Manter as quatro adaptações **textuais e versionadas** com identificador de versão local; mudanças em semântica precisam de review independente.
5. Fonte MIT: addyosmani/agent-skills@aeac41d4d005999432bb7312f7ff06383a91d59d; Copyright (c) 2025 Addy Osmani. Arquivo de licença: https://github.com/addyosmani/agent-skills/blob/aeac41d4d005999432bb7312f7ff06383a91d59d/LICENSE . Em eventual redistribuição de código copiado substancialmente, preservar aviso de copyright e texto da licença. Estes wrappers foram redigidos como propostas próprias, com crédito à referência.
6. Manter registro de exceções decididas pelo Fundador/Program Control, com motivo e validade; nenhuma “autorização herdada” entre sessões.

## Aceite e condições de parada

**Aceite documental W3:** arquivo proposto curto, matriz explícita, quatro wrappers, versão externa fixa, stack/comandos reais e nenhum delta fora de docs/agent-engineering-r1/architecture/. Um PASS **documental** não é PASS da aplicação.

**STOP/BLOCKED:** conflito de ownership, ausência de evidência para afirmação crítica, risco de exposição de segredo, mudança em fonte externa sem inspeção, tentativa de execução produtiva, falta de autorização para mudança canônica ou pedido de automerge.

**Pendências externas:** avaliação de W4/W5, validação administrativa da proteção de main, reconciliação do Memorial e decisão de eventual piloto. Testes de runtime, E2E, build, CI, preview e deploy **não executados por W3**.
