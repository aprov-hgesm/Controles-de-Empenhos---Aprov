# Política de Testes do EMPROVEX

## Princípio

Os gates automáticos obrigatórios devem sinalizar falhas técnicas reais com baixa taxa de falso positivo. O Browser E2E não é requisito permanente para merge ou deploy.

## Gates automáticos obrigatórios

Continuam obrigatórios no CI normal:

- instalação reproduzível de dependências;
- TypeScript;
- build de produção;
- testes de domínio e contratos;
- guards estruturais e de segurança;
- testes de Firestore/isolamento por workspace quando aplicáveis;
- proteção do núcleo EMPROVEX;
- higiene do diff.

## Browser E2E

O Browser E2E com Firebase Emulator fica disponível em workflow separado, executado sob demanda.

Usar principalmente quando houver alteração material em:

- autenticação, sessão ou revogação;
- navegação crítica entre superfícies;
- fluxo integrado NF → estoque → saída;
- permissões externas que dependam de interação no navegador;
- comportamento responsivo ou interação difícil de validar apenas por testes de domínio;
- regressão que só se reproduza no navegador.

O E2E não deve bloquear merge/deploy apenas por falha de infraestrutura, timeout ou encerramento incorreto de emuladores quando os testes executados não identificaram regressão.

## Validação manual

Para funcionalidades fortemente operacionais ou visuais, a validação manual assistida pelo operador é parte legítima do processo. Ela deve ser preferida quando permite avaliar com mais fidelidade fluxo, ergonomia, leitura, foco, teclado, scanner, posicionamento visual ou comportamento real da interface.

Sempre que possível, a mudança deve chegar ao teste manual já protegida por typecheck, build, testes de domínio, guards e testes de segurança relevantes.

## Registro

Decisão consolidada em 30/09/2026 após o Browser E2E completar 25/25 testes com sucesso e, ainda assim, o job ser cancelado posteriormente por não encerrar corretamente os processos auxiliares.
