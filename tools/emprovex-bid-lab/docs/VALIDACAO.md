# Evidências R0.1 — 06/11/2026

Executadas em Node.js v24.22.1, Linux, com o código desta entrega:

- PASS — `npm test`: 44 testes, 0 falhas, 0 skips. Inclui 43 cenários do motor/orquestração e 1 teste HTTP integrado com servidor real, 3 assets válidos, arquivo fora da lista negado e POST negado.
- PASS — duas varreduras de 10.000 preços cada para piso/teto, dentro dos testes acima (não contabilizadas como 20.000 testes independentes).
- PASS — `node --check` no content script, painel e módulo do simulador.
- BLOQUEADO — `tests/browser.cjs`: Playwright instalado no runtime, mas Chromium ausente. Instalação tentada; download retornou arquivo inválido/truncado. Nenhum teste visual/DOM/Manifest da extensão pode ser declarado PASS.
- NÃO EXECUTADOS — Windows/Edge, QA mobile, teste em portal real, autenticação real, sessão multi-CNPJ, extensão empacotada/loja e testes de adversário.

Primeira revisão detectou e corrigiu possibilidade de remover estado incerto com botão Parar; regressão adicionada. Após introduzir timeout, teste de parada durante leitura precisou aguardar a criação da Promise; teste corrigido e executado. Inicialização do content script agora espera o primeiro snapshot local para evitar corrida com o módulo do simulador.

Não houve build do EMPROVEX porque nenhuma aplicação existente foi alterada/importada. Não houve merge/deploy, envio externo, execução de código de terceiros nem credenciais reais. Resultado: GO para revisão e teste local; NO-GO para operação real. A suíte de navegador está entregue para execução posterior e não é substituída por testes unitários.
