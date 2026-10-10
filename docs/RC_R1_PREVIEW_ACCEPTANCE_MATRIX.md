# EMPROVEX R1 — Macroação 3/4: aceitação controlada no Preview

Data: 2026-10-09 · Estado inicial: **EM VALIDAÇÃO — NENHUM SMOKE HUMANO APROVADO AINDA**

## 1. Onde estamos — referência autoritativa

RC congelado `rc-r1-global-frozen-2026-10-09@61e372225834ed6060cd2b36dbdd55d1e1979c2c`, PR #280.
URL exata do Preview fornecida pelo bot Vercel do PR #280:
https://controles-de-empenhos-aprov-git-rc-886227-aprov-hgesms-projects.vercel.app

Deploy `9QKH5X4r1umD5AFVvtw2NckkhQLX`, status **READY** conforme commit Vercel e comentário GitHub para esse SHA. `READY` comprova publicação do build, **não** aprovação funcional.

A Vercel conectada a esta sessão NÃO possui acesso ao projeto `aprov-hgesms-projects` (403), e este ambiente não conseguiu alcançar o host diretamente (falha de DNS externo). Nenhum cookie, segredo, bypass ou credencial de usuário foi utilizado. Workflow read-only remoto foi preparado na branch documental para confirmar rotas públicas.

## 2. Regras invioláveis

- Somente **Preview HTTPS associado ao SHA 61e372225834ed6060cd2b36dbdd55d1e1979c2c**; jamais Production. NÃO publicar Rules neste estágio.
- Testes que escrevem dados somente em ambiente descartável `aprovisionamento-teste`, se comprovadamente isolado e liberado pelo operador. Tirar evidência/backup do conjunto fictício antes. Não usar `aprovisionamento-3-gac-ap` ou `aprovisionamento-2-b-fv`: workspaces reais de usuários.
- Não executar transferência, entrada, inventário, cancelamento ou exclusão em dados de usuários reais. Sem billing, suspensão, ativação de cobrança ou alteração de usuários VIP.
- Identidade de teste: founder autorizado e 2 contas fictícias setoriais em workspace descartável, e-mail verificado/claims corretas; não usar credenciais compartilhadas nem expô-las em logs.
- Não simular PASS. Evidência: dispositivo, navegador, versão, URL, SHA, horário, usuário de teste (UID parcial/redigido), ações, resultados, prints sem dados sensíveis.
- Em caso de operação incerta: verificar ledger/saldos antes de repetir; não pressionar múltiplas confirmações e duplicar uma movimentação.
- Antes de usar o scanner, confirmar HTTPS e câmera same-origin; permitir/recusar; fallback manual; não depender de acesso à produção para comprovar comportamento.
- Testes físicos são executados por operador humano; o Coordenador audita e registra. Falha bloqueante exige novo RC e todos os gates reexecutados.

## 3. Matriz de aceitação (a executar)

| ID | Cenário | Critério de PASS | Estado | Executor |
|---|---|---|---|---|
| P01 | Preview HTTPS /api/health | 200, JSON status=ok, timestamp, cache no-store | PENDENTE | Coordenador, workflow GET |
| P02 | Termos /terms e Privacidade /privacy | Páginas HTTPS 200 com títulos corretos | PENDENTE | Coordenador, workflow GET |
| P03 | Redirecionamento sem sessão | Acesso ao app não expõe estoque, NF ou usuários sem autenticação | PENDENTE | Coordenador + operador |
| P04 | Founder login/logout no desktop | Login autorizado, isolamento, logout realmente revoga sessão | PENDENTE | Operador humano |
| P05 | Login setorial, e-mail/claims | Usuário setorial autorizado no workspace/UG corretos | PENDENTE | Operador humano |
| P06 | Dois usuários e duas workspaces | Cross-workspace/UG negado; VIP conservado; sem vazamento | PENDENTE | Operador humano |
| P07 | Legal aceite/versionamento | Novo usuário sem aceite bloqueado; aceite libera; registro correto | PENDENTE | Operador humano |
| P08 | Central Depósitos desktop | Depósitos, locais, subposições, saldos e histórico coerentes | PENDENTE | Operador humano |
| P09 | NF pendente → alocação F05 | Operação única gera movimento único e saldo físico correto | PENDENTE | Operador humano, dados fictícios |
| P10 | Replay F05 idêntico e colisão | Replay atual idempotente; divergente 409; legado sinalizado | PENDENTE | Operador humano, dados fictícios |
| P11 | Transferência F06 físico→físico | Origem diminui, destino aumenta, agregado constante | PENDENTE | Operador humano, dados fictícios |
| P12 | Concorrência F06 entre usuários | Um vencedor, perdedor insuficiente, saldo não negativo | PENDENTE | Operador humano, dados fictícios |
| P13 | Saída F09 com lote | Saída única, rastreio, saldo exato, replay sem duplicar | PENDENTE | Operador humano, dados fictícios |
| P14 | Inventário TOTAL e posição | Contagem/ajuste físico preserva domínio; UNASSIGNED não é posição operacional | PENDENTE | Operador humano, dados fictícios |
| P15 | Consulta e conferência móvel | Posição esperada, material, lote e quantidade coerentes | PENDENTE | Operador humano |
| P16 | Code128 físico / etiquetas | Scanner lê Code128 físico, rotas corretas, impressão <=35 mm | PENDENTE | Operador humano com etiqueta |
| P17 | Permissões da câmera | Concedida, negada e indisponível; fallback manual funciona | PENDENTE | Operador humano Android Chrome |
| P18 | Double-scan / cooldown | Uma leitura não cria ações duplicadas; feedback perceptível | PENDENTE | Operador humano Android Chrome |
| P19 | Rede offline/online e retry | Falha fechada e recuperação sem segunda operação/cobrança indevida | PENDENTE | Operador humano |
| P20 | Desktop ↔ celular simultâneos | Mesmo ledger e saldo após atualização; UI sem saldo stale autoritativo | PENDENTE | Operador humano |
| P21 | Responsividade e velocidade | Usável em PC modesto e Android com rede real; documentar tempos | PENDENTE | Operador humano |
| P22 | Safari iPhone, se disponível | Fluxos essenciais compatíveis ou limitação documentada | PENDENTE | Operador humano |
| P23 | Saúde e recuperação Preview | Endpoint sem dados sensíveis, rollback documentado, sem restore real | PENDENTE | Coordenador + operador |
| P24 | Custos/retries observados | Instrumentação de leituras/tempo pronta para macroação 4 | PENDENTE | Coordenador + operador |

## 4. Sequência operacional e evidências

1. Conferir o SHA apresentado na implantação junto ao ID do deploy GitHub/Vercel e o domínio Preview; verificar que não é Production.
2. Executar **somente GET** público (workflow). Se houver Vercel Authentication 401/403, marcar `BLOCKED_BY_ACCESS_CONTROL`, não FAIL funcional e não tentar contornar com bypass não autorizado.
3. No dispositivo real, abrir URL e gravar status do fluxo sem autenticação; depois autenticar com credencial própria **sem colar senhas em relatório/chat**.
4. No workspace fictício `aprovisionamento-teste`, após verificação do isolamento, usar dados fictícios pequenos e antes/depois do ledger para P09–P14. Solicitar autorização específica antes de qualquer operação com potencial afetar usuário real.
5. Mobile: HTTPS, Code128, câmera concedida/negada, fallback, som/vibração, duplo scan e perda de rede.
6. Exportar evidências redigidas e atualizar a matriz com PASS/FAIL/BLOCKED e links. Critérios: **24/24** concluídos ou exclusões justificadas pelo Coordenador e aceitas pelo Fundador; P03/P05/P06/P09–P14/P16–P20 são gates críticos.

## 5. Riscos a não mascarar

- F05 legado: note histórica sem `intent:` recebe 409 fail-closed; UX/tratamento assistido ainda não certificado.
- F06 Rules 1000 expressions: fallback por prova de servidor, custo/latência não medidos.
- Vercel account team scope 403. Login real, funcionalidade mobile e escrita no Preview não podem ser certificados por Github Actions públicos.
- O Preview READY não prova que as Firestore Rules correspondentes estejam publicadas no projeto de teste; confirmar a versão/hashes no ambiente autorizado antes de P09–P14. NÃO publicar Rules automaticamente.

## 6. Quem faz / próximo passo

Coordenador executa validação GET, confere deploy/identidade do SHA, atualiza memorial e registra impedimentos; Fundador/operador físico executa P03–P24 com ambientes e autorização adequados. Worker especializado só reabre para bug comprovado. Estado atual **PARCIAL** até evidências físicas e login real. Não iniciar macroação 4 como concluída antes disso.
