# SKILL PROPOSTA — code-review-and-quality / EMPROVEX

**Versão local:** 0.1-DRAFT. **Origem:** addyosmani/agent-skills/skills/code-review-and-quality/SKILL.md @ aeac41d4d005999432bb7312f7ff06383a91d59d (MIT; Copyright (c) 2025 Addy Osmani). **Status:** checklist de revisão proposto.

## Carregar quando
PR pronto para revisão, diff relevante concluído, correção de regressão ou handoff que requer decisão técnica.

## NÃO carregar quando
Usado como autorização substituta de merge/GO/deploy, como prova de CI não executado ou para iniciar mutação de dados/sistema.

## Cinco eixos
1. **Correção:** contrato funcional, testes apropriados, idempotência, concorrência, persistência.
2. **Legibilidade:** nomenclatura consistente, fluxo compreensível, ausência de complexidade gratuita.
3. **Arquitetura:** ownership, isolamento EMPROVEX/warehouse, fronteiras de módulos, dependências.
4. **Segurança:** Firestore/tenant, segredos, permissões, dados não confiáveis e efeito produtivo.
5. **Performance:** renderização, custos de Firestore, caminhos críticos e regressões de consumo, quando aplicável.

## Fluxo de revisão
Ler contrato, base e diff; verificar testes antes de aceitar alegações; checar os cinco eixos; categorizar BLOCKER / REQUER CORREÇÃO / SUGESTÃO / INFORMATIVO; solicitar correções dentro do ownership. Um revisor independente confronta evidência e proposta. Uso de outra IA é opcional e depende de disponibilidade/autorização; **não executar** mutação experimental ou shell sem escopo aprovado.

## Evidência de saída
SHA-alvo, PR, caminhos, achados com localizações, testes realmente rodados e status, riscos, decisão técnica **não vinculante** e pontos para aprovação formal do Coordenador/Fundador.

## Sem suporte a subagentes
Gerar pacote para revisor designado; se só houver autocrítica, registrar explicitamente “revisão não independente”.

## Limites
Não alterar teste, guard ou workflow para tornar revisão verde; não apagar código fora do escopo nem decretar merge, release ou publicação. Caso de divergência de autoridade: Program Control arbitra.
