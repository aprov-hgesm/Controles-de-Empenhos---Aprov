# EMPROVEX Lances — laboratório independente R0.1

Protótipo funcional de motor determinístico + extensão Chromium + portal fictício local. Não há conector real para Compras.gov.br, BLL, Licitanet ou eBay. Não envia lances reais. Desenvolvimento separado de Empresas: nenhuma importação do site, Firebase, WLG, credencial, alteração militar ou deploy. Pasta independente, extraível para repositório próprio.

## Executar (Windows / PowerShell ou Linux)

Requer Node.js 22+ e Chrome/Edge desktop. Não há dependências npm para rodar o laboratório.

1. Baixe esta branch, entre em `tools/emprovex-bid-lab`.
2. Execute `npm test` e depois `npm start`.
3. Em `chrome://extensions` ou `edge://extensions`, habilite o modo de desenvolvedor, escolha **Carregar sem compactação** e selecione a pasta `extension`.
4. Abra **http://127.0.0.1:8790/**. Não use `localhost`: a origem é intencionalmente exata.
5. No painel EMPROVEX, confira a identidade fictícia e o piso `8.5000`, passo `0.1000`. Use ponto decimal. Clique **Ativar simulação**.
6. O primeiro lance será `9.9000`. Lance um concorrente a `8.6000`: o robô responde `8.5000`. Lance concorrente a `8.4000`: o robô para sem ultrapassar o piso.
7. Recarregue para reiniciar desarmado. Para leilão, selecione maior preço e configure teto `10.5000`. O primeiro lance será `10.1000`.

O botão Parar impede novas submissões, mas não desfaz uma já enviada. Não há recuperação automática: após resultado incerto, conferir/reiniciar o simulador. Nenhuma senha é solicitada. Retire a extensão ao encerrar os testes.

## Componentes

- `extension/engine.mjs`: dinheiro decimal exato (BigInt), piso/teto, incremento do portal, identidade, fase, validade temporal, posição, limite de tentativas, intervalo, exclusão concorrente e confirmação de resultado.
- `extension/panel.mjs`: painel e adaptador DOM exclusivamente local. Confirmação explícita para armar; controles de preço bloqueados durante uso.
- `extension/content.js` e `manifest.json`: origem restrita a 127.0.0.1; verificação adicional de porta 8790, caminho e marca do simulador. Nenhuma permissão para portais externos.
- `simulator`: portal fictício com revisão otimista, recibos idempotentes, concorrente manual e cenários de encerramento/desconexão/troca de identidade.
- `server.mjs`: servidor estático no loopback com lista de arquivos permitidos, sem API externa ou escrita.

## Limites deliberados

Somente disputa aberta por preço monetário, passo absoluto e item isolado. Não suporta desconto percentual, lote, empate ME/EPP, fase fechada, negociação, relógio oficial, leilão com prorrogação, leitura de edital, captura de login, execução desassistida em nuvem ou troca multi-CNPJ real. O simulador publica snapshots periodicamente; portais reais precisam de eventos/leituras confiáveis. O histórico é volátil e local. Não oferece isolamento seguro multiusuário, auditoria durável ou eleição de executor entre abas. Dois portais simulados são mundos separados; não certificam concorrência real entre dispositivos.

O adaptador é código confiável de teste. `kind: simulator` é uma barreira de projeto, não uma sandbox contra código malicioso. Conteúdo DOM e recibos fictícios não são prova de aceitação de um portal real. Após reload não se deve presumir a resolução de uma operação incerta real.

## Testes

`npm test`: motor e orquestração com mocks, propriedades de piso/teto e falhas. Teste opcional de extensão real: instale Playwright em ambiente QA separado, inicie `npm start` e execute `PLAYWRIGHT_MODULE=/caminho/playwright node tests/browser.cjs` (em Windows, defina `$env:PLAYWRIGHT_MODULE`). Veja `docs/VALIDACAO.md` para evidências efetivamente executadas.

## Continuidade

1. R0.2: persistência local de intenções/recibos, eleição de executor, exportação de auditoria e simulador com atraso/perda/duplicação.
2. R1: selecionar primeiro portal (candidato: Compras.gov.br); verificar termos, meios oficiais, campos e regras vigentes. Adaptador inicialmente somente leitura e modo assistido, validado em ambiente autorizado.
3. R2: testes de envio autorizado, confirmação real, reconciliação e bloqueio por fase/CNPJ/precisão/latência. Sem bypass de CAPTCHA/MFA ou controles do portal.
4. Integração futura: API versionada com workspace, permissões live e política aprovada; jamais depender de cookies globais para escolher o CNPJ de uma sessão ativa. Empresas recebe resultados confirmados, não cria automaticamente empenhos, estoque ou recebíveis.

GO para experimentação local. NO-GO para lances reais e integração produtiva até os testes específicos do portal.
