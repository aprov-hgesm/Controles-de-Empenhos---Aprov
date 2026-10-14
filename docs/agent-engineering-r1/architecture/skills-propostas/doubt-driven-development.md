# SKILL PROPOSTA — doubt-driven-development / EMPROVEX

**Versão local:** 0.1-DRAFT. **Origem:** addyosmani/agent-skills/skills/doubt-driven-development/SKILL.md @ aeac41d4d005999432bb7312f7ff06383a91d59d (MIT; Copyright (c) 2025 Addy Osmani). **Status:** método não executável.

## Carregar quando
Decisão de risco ou hipótese difícil de verificar: contrato cross-module, consistência do estoque, isolamento tenant, idempotência, lógica de recebimento, alteração de autenticação, desenho do RC e outras decisões arquiteturais com efeitos difíceis de reverter.

## NÃO carregar quando
Operação puramente mecânica, leitura de arquivo, checagem trivial ou tarefa cujo escopo não exige revisão adversarial. Não pedir subagentes automaticamente.

## Ciclo mínimo
1. **CLAIM:** escrever o que se pretende sustentar, em linguagem verificável.
2. **ARTIFACT+CONTRACT:** extrair diff/decisão e critérios objetivos sem conclusões enviesadas.
3. **DOUBT:** solicitar a um revisor independente **designado** que tente refutar invariantes e encontre condições de falha; não delegar novas permissões.
4. **RECONCILE:** classificar achados como falha confirmada, limitação de contrato, trade-off documentado ou falso positivo fundamentado.
5. **STOP:** registrar condição de parada e bloqueios remanescentes; não criar loop infinito, nem autocertificar risco crítico.

## Evidência de saída
Afirmação testada, artefato e SHA, invariantes, possíveis contraexemplos, resultados demonstrados, grau de independência da revisão e decisão humana pendente.

## Sem suporte a subagentes
Produzir um pacote objetivo para outro worker, coordenador ou revisão humana. Autochecagem local é apenas preliminar e deve ser rotulada “degradada / NÃO INDEPENDENTE”. Nunca inventar uma segunda revisão.

## Contexto antigo ou conflitante
Refazer checkout lógico da situação (main/branch/PR e contrato recente); uma crítica baseada em dados velhos não decide o estado atual. Encaminhar inconsistências ao Coordenador.

## Limites
Não invocar Codex CLI/Gemini CLI automaticamente, nem transcrever artefatos contendo segredos para modelo externo. Não criar novo nível hierárquico, não aumentar autonomia do worker, não alterar produção/Rules/RC/CI e não converter revisão favorável em GO.
