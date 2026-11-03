# ELEONOR CONTEXTO R4 — WC05 | Suporte, incidentes e resolução guiada

**Natureza:** auditoria estática e documentação isolada. **Base da PR #471:** `d7e649d71797b09173fe67c790099d0ceef81f4d`. **Código `main` consultado:** `57a55b172790865bdb9b9beffaaa55b6a19c1a28` (02/11/2026). **Entregas:** 24 cartões novos de troubleshooting e 144 perguntas sintéticas, com resposta esperada. **Integração e testes runtime:** não executados.

> MAIN significa encontrado no código; não prova que a revisão correspondente está recebendo tráfego Cloud Run. Sintoma relatado não comprova a causa. Conteúdo gerado por LFM3 não substitui fonte, W3 ou autorização.

## Índice

1. [Lacunas P0/P1/P2](#1-lacunas-p0p1p2)
2. [R1/R2/R3: crítica e novidades](#2-r1r2r3-crítica-e-novidades)
3. [Cobertura e 14 tutoriais oficiais](#3-cobertura-e-14-tutoriais-oficiais)
4. [Protocolo de triagem e severidade](#4-protocolo-de-triagem-e-severidade)
5. [Árvore de decisão](#5-árvore-de-decisão)
6. [Cartões rastreáveis](#6-cartões-rastreáveis)
7. [FAQ por perfil](#7-faq-por-perfil)
8. [Mensagens auditadas](#8-mensagens-auditadas)
9. [Testes, riscos e pendências](#9-testes-riscos-e-pendências)

## 1. Lacunas P0/P1/P2

**P0 — risco de integridade e exposição:** resposta incerta após baixa (K013–K014), inventário divergente (K018), cobrança duplicada (K019), dados possivelmente de outro workspace (K024). A Eleonor deve interromper repetição de escrita, conter exposição e recomendar suporte humano.
**P1 — roteiro discriminante ausente:** autenticação ≠ permissão; NF cadastrada ≠ NF visível; NE PDF ≠ Mapa SISCOFIS; cronograma salvo ≠ enviado ≠ recebido; saldo financeiro ≠ físico; scanner sem permissão ≠ barcode inválido; 401/403 ≠ 429 (K001–K021).
**P2 — fricção de ajuda:** catálogo fechado de 14 vídeos, busca por palavra e assunto, falta de vídeo móvel próprio e PWA potencialmente divergente (K005, K022–K023). Problema de cache específico ainda não comprovado.
**Não verificado:** logs, status de Cloud Run, incorporação do R3 ao motor, pagamentos, entregabilidade de e-mail, desempenho real, hardware de câmera, runtime autenticado, percepção do usuário. Não fabricar números de resolução.

## 2. R1/R2/R3: crítica e novidades

| Material existente | Evidência | Lacuna trabalhada em WC05 |
|---|---|---|
| R1 | 242 F-XX-YYY com passos e condição de interface | Não explica como triagem diferencia sintoma, diagnóstico, causa e conclusão; cartões associados a F sem criar função nova |
| R2 | 4.114 perguntas + 175 cenários + 123 turnos documentados | Perguntas frequentemente pedem HOWTO e não oráculo de falha, segurança, resultado ou escalonamento |
| R3 | 135 entradas linguísticas, 449 grafias, 2.169 exemplos JSONL | Cobertura léxica não é prova de troubleshooting; generalizações sobre permissão, leitura e escrita precisam de decisões verificáveis |
| WC05 | 24 cartões sintomáticos + 144 testes de 6 tipos | Fonte, causa não comprovada, pergunta mínima, ação proibida, risco, condição humana e teste observável por família |

**Correção metodológica:** o material R2/R3 é visível no GitHub; se usado para ajustar o motor, não pode ser chamado de *holdout cego*. WC05 usa `development` e `evaluation_candidate` (também visível). Esses 144 exemplos são testes propostos, **não** 144 acertos e **não** treinamento integrado.
**Confiança:** ALTA = mensagem/controle visto em código; MÉDIA = fluxo comprovado e causa não verificada; BAIXA = triagem defensiva de uma hipótese sem observação real. A marca de disponibilidade classifica o fluxo, nunca prova a incidência ou a versão publicada.

## 3. Cobertura e 14 tutoriais oficiais

| Famílias | Cartões | Cobertura diferencial |
|---|---|---|
| Acesso/identidade | K001–K004 | Login, recuperação, permissão, aceite |
| PWA/UX/NF | K005–K008 | Versão visual, lentidão, formulário, importador NE |
| Cronograma/saldo/SISCOFIS | K009–K012 | Remessa, envio, saldo conceitual, Mapa PDF |
| Depósitos/inventário | K013–K015, K018 | Bloqueio de saída, idempotência, visualizações, contagem |
| Móvel | K016–K017, K023 | Câmera, barcode, guia publicado |
| Billing/Eleonor | K019–K021 | Checkout, gate, autorização/limite de consultas |
| Ajuda e incidente | K022, K024 | Filtros, segurança entre setores |

### Inventário conferido em `features/support/tutorialCatalog.ts`

| Nº | Título exato | Categoria |
|---:|---|---|
| 01 | Como cadastrar empenhos no EMPROVEX | Primeiros passos |
| 02 | Explore a aba Empenhos | Empenhos |
| 03 | Painel EMPROVEX: visão geral da gestão | Primeiros passos |
| 04 | Consulte os itens | Itens e fornecedores |
| 05 | Cronogramas e fornecedores | Cronogramas |
| 06 | Acompanhe as notas fiscais | Notas fiscais |
| 07 | Cadastre uma nova NF | Notas fiscais |
| 08 | Comissão de Recebimento | Notas fiscais |
| 09 | Conheça os relatórios | Relatórios |
| 10 | Conheça a Central 3D | Depósitos |
| 11 | Validade dos materiais | Depósitos |
| 12 | Alocação de materiais | Depósitos |
| 13 | Saída de materiais | Depósitos |
| 14 | Controle de depósitos e etiquetas | Depósitos |

O catálogo tem **exatamente 14** vídeos fixos; o player só carrega após ação do usuário e permite abrir o vídeo no YouTube. A busca normaliza acentos, utiliza palavras-chave e respeita filtro de assunto. Nenhum vídeo novo foi inferido.
**Operador Móvel:** `EmprovexHelpCenter.tsx` informa explicitamente ausência de vídeo próprio nesse catálogo e oferece demonstração ilustrada em `/institucional#explorar`. Não chamar essa página de um 15º vídeo.
**Montagem na main:** `components/layout/AppSidebar.tsx` tem entrada **Central de Ajuda**; `app/login/page.tsx` carrega `EmprovexHelpOverlay.tsx`; este contém o centro e trata Escape/foco. Visibilidade real em produção depende da revisão Cloud Run e do contexto da sessão.

## 4. Protocolo de triagem e severidade

1. **Classificar intenção:** HOWTO = explicar UI; READ = somente via W3 autenticado com filtro e workspace; WRITE = não executar por chat de suporte. Interpretação LFM3 é entrada não confiável, jamais executora.
2. **Acolher sintoma sem prometer causa:** perguntar o mínimo discriminante (etapa, mensagem, módulo), mesmo se o usuário disser “não funciona”.
3. **Coletar evidência minimizada:** rota/tela, horário aproximado, status/código real quando exibido, antes/depois do clique, navegador e alcance sem conta, CNPJ, token, e-mail privado, CPF, nota real, screenshot de terceiros ou logs identificáveis.
4. **Tentar uma ação segura e reversível:** conferir filtro, histórico, autorização, origem do documento ou entrada manual; não repetir write enquanto o resultado está incerto.
5. **Confirmar efeito:** há sucesso no histórico/autorização/estado exibido? Clique, PDF preparado, checkout aberto ou resposta fluente não provam persistência/entrega.
6. **Escalar com contexto mínimo:** não inventar número de chamado nem prazo; apontar canal oficial configurado em Ajuda. Segurança intersetorial e dupla baixa requerem prioridade imediata.

| Severidade | Critério | Diretriz |
|---|---|---|
| P0 | Indício de exposição, pagamento potencialmente duplicado, saldo/inventário comprometido, baixa incerta | Interromper operação, preservar relato sanitizado e encaminhar imediatamente |
| P1 | Sem acesso, falha persistente, impeditivo de operação, IA supostamente habilitada não funciona | Uma triagem reversível e encaminhamento se persistir |
| P2 | Tutorial não encontrado, instrução visual, PWA cosmético | Orientação, documentação existente e escalonamento se reproduzido |

**Relato padronizado sem dados reais:** `área: [módulo]; etapa: [antes/após]; horário: [aproximado]; esperado: [descrição]; observado: [mensagem]; dispositivo: [tipo]; alcance: [um/vários]; tentativa segura: [ação]; dados sensíveis: omitidos`.
**Proteção de sessão:** nunca solicitar senha, e-mail privado, link de recuperação, cookie, token, código MFA, chave API, CVV, CPF/CNPJ real ou dados de outra UG. Eleonor não tem acesso implícito a Firestore, Firebase Auth, log Cloud Run, navegador do usuário, conta bancária ou Gmail.

## 5. Árvore de decisão

```text
Não entra ── login/redefinição? ─> K001–K002
          └─ já autenticado, mas sem módulo/aceite? ─> K003–K004
Não vê registro ── falha em cadastro/importação? ─> K007–K008/K012
                └─ filtro/escopo/saldo físico? ─> K011/K015
Não finaliza operação ── saída pode ter ocorrido? ─> K013–K014; NÃO REPETIR
                       └─ cronograma? ─> K009–K010
Scanner ── câmera não abre? ─> K016
        └─ código rejeitado depois de ler? ─> K017
Checkout ── pagamento não confirmado? ─> K019; NÃO PAGAR DE NOVO
Eleonor ── 404/flag? ─> K020; 401/403/429? ─> K021
Ajuda ── filtro/vídeo? ─> K022; guia móvel? ─> K023
Suspeita entre setores ─> K024; não investigar por exploração
```

## 6. Cartões rastreáveis

### WC05-K001 — Login do setor recusado

- **Domínio:** `autenticacao`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-01-001`. **Disponibilidade:** `MAIN`. **Visibilidade:** `public`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Login do setor recusado; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A falha apareceu antes ou após clicar Entrar? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Conferir modalidade setor, rota oficial e mensagem; se apropriado usar recuperação legítima.
- **Proibição expressa:** Pedir senha, testar conta alheia ou alterar autenticação.
- **Escalonamento humano:** Falha persiste após verificação ou afeta várias contas.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `components/auth/EmprovexLogin.tsx`; `app/login/page.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T001-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K002 — Redefinição de senha sem e-mail

- **Domínio:** `autenticacao`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-01-003`. **Disponibilidade:** `MAIN`. **Visibilidade:** `public`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Redefinição de senha sem e-mail; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O formulário de recuperação confirmou a solicitação ou apresentou erro? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Verificar a própria caixa de entrada e spam, sem compartilhar link ou código.
- **Proibição expressa:** Solicitar link de redefinição, token ou acesso à caixa postal.
- **Escalonamento humano:** Solicitação falha repetidamente ou e-mail não chega após conferência normal.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `components/auth/EmprovexLogin.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T002-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K003 — Menu Depósitos abre acesso negado

- **Domínio:** `autorizacao`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-01-013`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Menu Depósitos abre acesso negado; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O bloqueio ocorre ao entrar na Central ou ao realizar uma operação? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Confirmar o workspace esperado e consultar administrador autorizado quanto ao acesso.
- **Proibição expressa:** Trocar UG na URL, forjar token ou sugerir bypass de permissões.
- **Escalonamento humano:** Direito confirmado pelo administrador mas acesso continua negado.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `components/layout/AppSidebar.tsx`; `features/warehouse/components/WarehouseProtectedSurface.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T003-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K004 — Aceite de termos impede avanço

- **Domínio:** `sessao`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-01-005`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Aceite de termos impede avanço; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A tela pede aceite legal ou está retornando ao login? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Ler os termos e aceitar somente por decisão própria; usar saída/login normal para sessão antiga.
- **Proibição expressa:** Aceitar em nome de terceiros, remover bloqueio legal ou capturar cookies.
- **Escalonamento humano:** Aceite legítimo realizado e a tela segue presa.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `app/login/page.tsx`; `docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T004-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K005 — PWA antigo ou ícone desatualizado

- **Domínio:** `pwa`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-15-016`. **Disponibilidade:** `MAIN`. **Visibilidade:** `public`. **Severidade:** `P2`. **Certeza:** BAIXA — causa não comprovada.
- **Sintoma observável:** PWA antigo ou ícone desatualizado; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A divergência só ocorre no PWA ou também na navegação privada? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Comparar a mesma rota no navegador e no aplicativo instalado, fechando/reabrindo sem apagar dados.
- **Proibição expressa:** Limpar armazenamento indiscriminadamente, prometer cache como causa ou afirmar deploy.
- **Escalonamento humano:** Diferença reproduzível após passos não destrutivos.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `app/manifest.ts`; `app/layout.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T005-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K006 — Carregamento lento ou operação pendente

- **Domínio:** `performance`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-01-011`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** BAIXA — causa não comprovada.
- **Sintoma observável:** Carregamento lento ou operação pendente; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A lentidão é para leitura de tela ou após confirmar operação? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Registrar módulo e horário; só para leitura, comparar modo Essencial e outra tela sem reenviar transações.
- **Proibição expressa:** Clicar repetidamente em salvar/retirar ou afirmar diagnóstico por logs inexistentes.
- **Escalonamento humano:** Impede trabalho repetidamente, muitas pessoas afetadas ou resultado de escrita incerto.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `components/layout/OperationalSurfaceLoading.tsx`; `app/login/page.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T006-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K007 — NF não salva ou desaparece em lista

- **Domínio:** `notas_fiscais`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-04-007`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** NF não salva ou desaparece em lista; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Houve erro no formulário, confirmação de salvamento ou apenas ausência na lista? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Conferir validações, filtros de período/NE e listagem antes de refazer a NF.
- **Proibição expressa:** Inserir dados fictícios, duplicar cadastro ou afirmar gravação no Firestore.
- **Escalonamento humano:** Falha contínua após dados válidos e filtros revisados.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/notas-fiscais/components/NotasFiscaisView.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T007-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K008 — PDF de Nota de Empenho interpretado incorretamente

- **Domínio:** `importacao_ne`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-03-008`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** PDF de Nota de Empenho interpretado incorretamente; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O PDF foi recusado ou a prévia veio com campos diferentes? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Identificar que é NE, revisar prévia e não confirmar valores incompletos.
- **Proibição expressa:** Aceitar dados errados para corrigir depois ou confundir NE com NF.
- **Escalonamento humano:** Prévia válida permanece incorreta ou há risco de registro financeiro equivocado.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/empenhos/components/EmpenhosView.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T008-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K009 — Remessas incompatíveis com saldo da NE

- **Domínio:** `cronograma`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-05-002`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Remessas incompatíveis com saldo da NE; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O total programado diverge do saldo da NE ou entre as remessas? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Revisar NE, exercício, filtros e quantidades antes de salvar/enviar.
- **Proibição expressa:** Mudar saldo oficial ou enviar cronograma para testar.
- **Escalonamento humano:** Divergência persiste após conferir distribuição e filtros.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/cronogramas/components/CronogramasView.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T009-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K010 — Cronograma sem confirmação de envio

- **Domínio:** `envio_cronograma`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-05-012`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Cronograma sem confirmação de envio; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A tela mostrou Enviando, Último envio ou erro? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Verificar histórico de envios na NE antes de reenviar; diferenciar envio de entrega.
- **Proibição expressa:** Reenvio repetido ou afirmar leitura pelo destinatário sem prova.
- **Escalonamento humano:** Histórico e relato do destinatário continuam incompatíveis.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/cronogramas/components/CronogramasView.tsx`; `features/cronogramas/components/CronogramaEnviosView.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T010-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K011 — Saldo financeiro confundido com estoque físico

- **Domínio:** `saldo`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-11-003`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Saldo financeiro confundido com estoque físico; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Saldo da NE a receber ou quantidade disponível em posição física? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Conferir tipo de saldo, unidade, filtro e período, sem alterar número.
- **Proibição expressa:** Ajustar estoque só para igualar saldo de NE ou inventar valor READ.
- **Escalonamento humano:** Divergência material após conciliação autorizada.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/empenhos/components/EmpenhosView.tsx`; `features/warehouse/components/WarehouseStockOperational.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T011-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K012 — Mapa SISCOFIS PDF recusado

- **Domínio:** `siscofis`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-10-009`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Mapa SISCOFIS PDF recusado; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Falhou antes da leitura ou após exibir linhas inválidas? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Verificar Mapa de Existência PDF e limite de 15 MB; revisar erros antes de confirmar.
- **Proibição expressa:** Usar Pedido como Mapa, ignorar erro bloqueante ou forçar importação.
- **Escalonamento humano:** PDF adequado ainda falha ou extração apresenta perdas sistemáticas.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/warehouse/components/WarehouseSiscofisOperational.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T012-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K013 — Saída bloqueada por lote, saldo ou posição

- **Domínio:** `saida_movel`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-12-010`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P0`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Saída bloqueada por lote, saldo ou posição; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A mensagem menciona saldo, validade, posição, destino ou autorização? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Conferir posição, validade, quantidade e histórico antes de nova tentativa.
- **Proibição expressa:** Burlar validade, falsificar quantidade ou forçar requisição de baixa.
- **Escalonamento humano:** Operação crítica bloqueada ou saldo inconsistente após a tentativa.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Integridade do estoque.
- **Origem verificável:** `features/warehouse/mobile/WarehouseMobileOutbound.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T013-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K014 — Resposta incerta após confirmar retirada

- **Domínio:** `idempotencia`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-12-011`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P0`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Resposta incerta após confirmar retirada; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O botão de confirmação foi acionado antes do travamento? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Consultar registro e saldo autenticados antes de iniciar outra operação.
- **Proibição expressa:** Refazer retirada às cegas ou modificar chave de idempotência.
- **Escalonamento humano:** Resultado transacional incerto, operação urgente ou diferença no ledger.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Integridade do estoque.
- **Origem verificável:** `features/warehouse/mobile/WarehouseMobileOutbound.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T014-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K015 — Croqui 2D diverge do 3D

- **Domínio:** `deposito_visual`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-09-009`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Croqui 2D diverge do 3D; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Difere geometria, nome da posição ou saldo? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Comparar o mesmo depósito e local nas duas vistas após reabrir sem editar.
- **Proibição expressa:** Excluir local com saldo, reconstruir endereço por palpite ou atribuir bug à sincronização.
- **Escalonamento humano:** Divergência reproduzível com risco de localização física.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/warehouse/components/WarehouseCroquisR1Operational.tsx`; `features/warehouse/components/WarehouseDepotViewOperational.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T015-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K016 — Câmera negada ou não encontrada

- **Domínio:** `camera`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-13-002`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Câmera negada ou não encontrada; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** É Permissão de câmera negada ou Nenhuma câmera utilizável foi encontrada? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Usar permissão do navegador se desejado ou entrada manual prevista.
- **Proibição expressa:** Burlar permissão de câmera ou alegar acesso remoto ao dispositivo.
- **Escalonamento humano:** Com permissão e hardware funcional ainda falha; entrada manual também indisponível.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/warehouse/mobile/WarehouseMobileScanner.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T016-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K017 — Etiqueta inativa, desconhecida ou incompatível

- **Domínio:** `barcode`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-12-003`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Etiqueta inativa, desconhecida ou incompatível; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O leitor esperava material, local ou subposição? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Conferir modalidade da leitura e etiqueta física antes de consultar item.
- **Proibição expressa:** Inventar código de barras, atribuir item qualquer ou contornar validação.
- **Escalonamento humano:** Etiqueta ativa é sistematicamente rejeitada ou mapeia item incorreto.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/warehouse/mobile/WarehouseMobileScanner.tsx`; `features/warehouse/mobile/WarehouseMobileOutbound.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T017-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K018 — Contagem física não conciliada

- **Domínio:** `inventario`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-11-009`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P0`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Contagem física não conciliada; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A diferença foi observada em posição/lote ou no consolidado? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Revisar contagem física, unidade, localização e histórico com responsável.
- **Proibição expressa:** Zerar estoque por palpite, editar ledger ou alegar conferência realizada.
- **Escalonamento humano:** Diferença significativa sem causa ou risco para atendimento.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/warehouse/components/WarehouseInventoryOperational.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T018-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K019 — Checkout concluído e assinatura pendente

- **Domínio:** `pagamento`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-15-005`. **Disponibilidade:** `MAIN`. **Visibilidade:** `sector`. **Severidade:** `P0`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Checkout concluído e assinatura pendente; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** O pagamento foi concluído ou houve somente retorno ao site? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Consultar histórico de cobrança do próprio setor e confirmação do provedor; não pagar de novo automaticamente.
- **Proibição expressa:** Pedir dados de cartão, CVV, token ou marcar pago manualmente.
- **Escalonamento humano:** Provedor confirmou pagamento, mas conta segue bloqueada.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Risco de cobrança duplicada.
- **Origem verificável:** `app/regularizacao/page.tsx`; `app/api/billing/regularization/route.ts`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T019-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K020 — Eleonor 404 ou AI_EXPERIMENT_DISABLED

- **Domínio:** `eleonor_gate`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-16-008`. **Disponibilidade:** `GATED`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Eleonor 404 ou AI_EXPERIMENT_DISABLED; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** A aba não aparece ou o chat retorna a mensagem de não habilitada? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Explicar gate por ambiente e indicar Ajuda enquanto não houver habilitação confirmada.
- **Proibição expressa:** Mandar alterar flag no navegador ou afirmar inferência Ollama ativa.
- **Escalonamento humano:** Ambiente homologado para o setor continua bloqueado.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/eleonor/components/EleonorExperience.tsx`; `app/api/emprovex-ai/ask/route.ts`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T020-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K021 — Eleonor 401, 403, 429 ou sem NF

- **Domínio:** `eleonor_http`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-16-006`. **Disponibilidade:** `GATED`. **Visibilidade:** `sector`. **Severidade:** `P1`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Eleonor 401, 403, 429 ou sem NF; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Qual mensagem ou status surgiu: 401, 403, 429 ou indisponibilidade genérica? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Em 401/403 confirmar sessão; em 429 reduzir repetição; READ somente com W3 e workspace.
- **Proibição expressa:** Expor NF de outra UG, assumir acesso a logs ou usar texto LFM3 como dado verificado.
- **Escalonamento humano:** Conta autorizada ainda falha após diagnóstico proporcional.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/eleonor/components/EleonorExperience.tsx`; `app/api/emprovex-ai/ask/route.ts`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T021-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K022 — Busca na Central de Ajuda sem resultado

- **Domínio:** `busca_ajuda`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-15-012`. **Disponibilidade:** `MAIN`. **Visibilidade:** `public`. **Severidade:** `P2`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Busca na Central de Ajuda sem resultado; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Que termo foi digitado e qual filtro de assunto estava ativo? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Usar filtro Todos e termo curto; procurar contato oficial se tema não consta entre 14 vídeos.
- **Proibição expressa:** Inventar vídeo, link ou dizer que qualquer tema tem tutorial.
- **Escalonamento humano:** Vídeo listado no catálogo não aparece após filtro apropriado.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/support/tutorialCatalog.ts`; `features/support/EmprovexHelpCenter.tsx`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T022-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K023 — Operador Móvel sem vídeo oficial no catálogo

- **Domínio:** `ajuda_movel`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-13-001`. **Disponibilidade:** `MAIN`. **Visibilidade:** `public`. **Severidade:** `P2`. **Certeza:** ALTA — mensagem/controle visto no código.
- **Sintoma observável:** Operador Móvel sem vídeo oficial no catálogo; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** Você procura vídeo ou demonstração ilustrada para uma operação específica? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Indicar /institucional#explorar, guia ilustrado, e ajudar conforme operação existente.
- **Proibição expressa:** Inventar o 15º vídeo ou prometer conteúdo não publicado.
- **Escalonamento humano:** Demonstração ilustrada inacessível ou sem a etapa necessária.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Interrupção ou informação inconsistente.
- **Origem verificável:** `features/support/EmprovexHelpCenter.tsx`; `features/support/tutorialCatalog.ts`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T023-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

### WC05-K024 — Suspeita de dados de outro workspace

- **Domínio:** `seguranca`. **Intenção:** `SUPPORT_TRIAGE`. **featureId:** `F-14-022`. **Disponibilidade:** `MAIN`. **Visibilidade:** `admin`. **Severidade:** `P0`. **Certeza:** MÉDIA — fluxo auditado; incidente não observado.
- **Sintoma observável:** Suspeita de dados de outro workspace; a causa concreta permanece **não verificada** até evidência do evento.
- **Pergunta mínima e confirmação de etapa:** São dados concretos incompatíveis com seu setor ou apenas rótulo genérico? Registrar resposta e a última etapa efetivamente concluída antes de avançar.
- **Evidência útil:** texto de erro sem valores identificáveis, tela, rota, horário aproximado, dispositivo e o que ocorreu após o clique. Quando pertinente, histórico autorizado e documento somente via canal protegido.
- **Tentativa segura:** Interromper operações, preservar descrição anonimizada e acionar suporte/admin imediatamente.
- **Proibição expressa:** Copiar dados, testar URLs de outra UG ou divulgar capturas públicas.
- **Escalonamento humano:** IMEDIATO em qualquer indício de exposição entre setores ou sessão comprometida.
- **Limite epistêmico:** Eleonor não vê logs, navegador, dados reais ou transações externas sem ferramenta explicitamente autorizada; não afirmar sucesso. Confidencialidade entre UGs.
- **Origem verificável:** `features/warehouse/components/WarehouseProtectedSurface.tsx`; `docs/EMPROVEX_FUNCIONALIDADES_MEMORIAL_OFICIAL.md`; código base `57a55b172790` (se arquivo em main) ou Memorial da PR #471.
- **Corpus:** `WC05-T024-01..06` (positivo, negação/adversarial, incompleto, correção, formal, informal); expectativas específicas no JSONL.

## 7. FAQ por perfil

| Público | Abordagem efetiva | Limite |
|---|---|---|
| Iniciante | Uma pergunta por vez, mostrar nome exato da aba e vídeo oficial; cadastro de NF -> tutoriais 06/07, K007 | Não prometer cadastro efetivo |
| Avançado | Conferir status por NE, remessas, histórico/último envio; K009–K011 | Não confundir envio com recebimento |
| Administrador | Tratar acesso entre setores como potencial P0, coletar descrição sanitizada e transferir, K024 | Não recomendar alterar IAM/Rules nem investigar dados alheios |
| Operador Móvel | Distinguir câmera, tipo de etiqueta e saldo/saída; oferecer entrada manual se prevista, K013–K017 | Não forçar scan nem repetir baixa |
| Todos | Confirmar se procura instrução, dado real ou execução | HOWTO não é READ nem WRITE |

## 8. Mensagens auditadas

| Código/arquivo main | Texto/estado confirmado no fonte | O que não comprova |
|---|---|---|
| `WarehouseMobileScanner.tsx:58-69` | “Permissão de câmera negada. Libere o acesso no navegador ou use a entrada manual.” / “Nenhuma câmera utilizável foi encontrada.” | Hardware/permissão atual do usuário |
| `WarehouseMobileOutbound.tsx:88-107` | `WAREHOUSE_MOBILE_OUTBOUND_LOTS_NOT_ELIGIBLE`, `WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK`, `WAREHOUSE_BARCODE_INACTIVE`, `WAREHOUSE_IDEMPOTENCY_CONFLICT` | Resultado de retirada real |
| `WarehouseSiscofisOperational.tsx:140-145` | “Selecione um Mapa de Existência em PDF.” / “O Mapa de Existência deve possuir no máximo 15 MB.” | Que todo PDF textual é compatível |
| `EleonorExperience.tsx:53-64` | `AI_EXPERIMENT_DISABLED`/404, 401/403, 429 e resposta de fallback | Se flag está ativada na revisão Cloud Run |
| `app/api/emprovex-ai/ask/route.ts:15-41` | `AI_INVALID_JSON`, `AI_REQUEST_TOO_LARGE`, `AI_AUTHENTICATION_FAILED`, `AI_UNAVAILABLE` | Logs privados, motivo final de incidente |
| `app/regularizacao/page.tsx:125-171` | Não pagar novamente a mesma cobrança; retorno do checkout não comprova baixa | Compensação de banco/provedor |
| `EmprovexHelpCenter.tsx:108-150` | Nenhum tutorial corresponde à busca; sem vídeo móvel no catálogo | Acessibilidade de vídeo YouTube do usuário |

## 9. Testes, riscos e pendências

### Critérios de avaliação

- **Estrutura (automatizável):** JSON válido por linha, 144 IDs e utterances únicos, `featureId` ligado ao memorial, `source`, `availability`, `visibility`, `partition`, intenção/comportamento/teste esperados e `shouldExecuteWrite=false`.
- **Semântica:** corrigir hipótese após nova informação; preservar negação; fazer pergunta mínima; reconhecer NF/NE/Mapa/checkout/baixa/status como fenômenos diferentes; bloquear acesso cruzado, dados privados e ações irreversíveis.
- **Disponibilidade:** MAIN = artefato no repositório; GATED = UI e endpoint com condição; PR/PILOTO/PAUSADO não são ensinados como produção. Não extrapolar a partir da URL do site nem da `main`.
- **Validação humana:** inspecionar 14 títulos, evidências reais de mensagens, cobertura de quatro perfis e risco de efeito adverso; dois tipos de teste (`development` e `evaluation_candidate`) são ambos públicos.
- **Integração futura separada:** somente após auditoria independente, verificação de release, testes de gates, W3/escopo e autorização de mudança; nada é executado nesta PR.

### Riscos e perguntas ainda sem resposta comprovada

- **P0:** operação com resposta incerta foi processada? pagou duas vezes? a informação era mesmo de outra UG? Exigem evidência oficial protegida, jamais resposta especulativa.
- **P1:** qual revisão Cloud Run está atendendo? qual erro exato de login/importação/cronograma ocorreu? o LFM3 foi acionado? qual resultado da consulta W3 autorizada? Não verificado.
- **P2:** qual navegador/cache causou UI velha? vídeos reproduzem em cada aparelho? por que a tela demora? Não verificado.
- **Regra de saída:** NÃO marcar READY nem integrar. Todos os materiais de avaliação presentes são visíveis; nenhuma amostra é holdout cego. Não foram feitos testes funcionais no ambiente real.

**Resumo do diferencial de R3:** WC05 não duplica 242 procedimentos nem 2.169 paráfrases; transforma 24 superfícies de falha em cartões rastreáveis com decisão, controle de dano, escalonamento, disponibilidade e 144 testes com expectativa explícita. Não equivale a 24 incidentes observados.
