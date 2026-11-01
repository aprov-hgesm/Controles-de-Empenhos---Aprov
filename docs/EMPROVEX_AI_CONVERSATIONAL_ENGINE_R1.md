# EMPROVEX AI — Eleonor Conversational Engine R1 (W7)

**Estado:** implementação isolada, PR DRAFT; não incluída na main nem em produção. **Base técnica:** W6 PR #450, SHA bf921fa917d0a2683cd0b434a81e9b7163803fc3. **Personalidade:** matriz Eleonor R1 na PR #455. **Worker paralelo:** E-P1, matriz R2, ainda independente.

## 1. Arquitetura efetivamente implementada

POST /api/emprovex-ai/ask -> gate Cloud Run homologação W6 -> parseAskInput -> Firebase Auth + setor/UG + billing W3 -> sessão e contexto W5 autenticados -> interpret W4 -> planConversation W7, apenas se permitido pela decisão W4 -> [resposta local verificada | LFM3 criativo opt-in] -> contrato emprovex.ai.ask.v1 inalterado.

- W3 conserva autorização e execução única de consultas. W4 continua classificando consultas operacionais, filtros, ambiguidades e bloqueios; W5 protege contexto criptográfico e filtros. W6 continua propondo JSON operacional em MODEL_ELIGIBLE, validado por W5 e W3.
- W7 não lê Firestore, não executa consultas nem mutações, não altera autorização, não conecta serviços externos e não introduz banco ou endpoint público.
- Mensagens explicitamente operacionais sempre seguem W4; W7 não substitui DETERMINISTIC, MODEL_ELIGIBLE nem decisões de segurança de W4.
- W7 pode distinguir pedidos de criação/revisão de texto genérico de comandos de escrita no banco, sem autorizar nenhuma ação operacional.
- Conversas sociais usam a rota adicional CONVERSATIONAL. Os campos version, status, intent, route, answer, reason, contextToken e metrics permanecem compatíveis com a interface da PR #453.

## 2. Taxonomia, tratamento e limites reais

| Família | Cobertura implementada | Estratégia |
|---|---|---|
| 01 Saudações/despedidas | Suportado | Resposta local curta |
| 02 Identidade | Suportado | Resposta local da matriz R1; sem biografia inventada |
| 03 Curiosidades | Suportado em escopo Eleonor | Curiosidade factual limitada à documentação |
| 04 EMPROVEX institucional | Parcial | Descrição genérica segura; autoria, preços e disponibilidade exigem fonte oficial |
| 05 Ajuda/orientação | Parcial | Pedido de contexto, sem tutoriais falsos; integração à Central de Ajuda pendente |
| 06 Conversa social | Suportado em exemplos curtos | Templates situados |
| 07 Humor | Parcial | Humor original controlado, sem geração ilimitada |
| 08 Escrita | Parcial e opt-in | LFM3 quando disponível e aprovado; indisponibilidade explícita |
| 09 Conhecimento geral | Não suportado como fonte aberta | Falta de catálogo externo verificado |
| 10 Planejamento | Parcial | Organização simples determinística e esclarecimento |
| 11 Ideação | Parcial e opt-in | LFM3 apenas em ambientes autorizados |
| 12 Perguntas sobre IA | Parcial | Capacidades concretas e limites, não fatos mutáveis |
| 13 Privacidade | Parcial | Explicações conservadoras; não substituir política institucional |
| 14 Data/tempo/atualidades | Parcial | Horário do servidor em America/Sao_Paulo; clima/notícias sem fonte recusados |
| 15 Matemática | Parcial | Operações aritméticas binárias limitadas e determinísticas |
| 16 Referências contextuais | Parcial | Tópico/última intenção autorizados; sem histórico textual |
| 17 Desconhecido | Suportado por esclarecimento | Sem inventar fatos nem enviar caso desconhecido ao LFM3 |
| 18 Segurança | Parcial | Guardas W4 prevalecem; regras locais conservadoras; revisão independente recomendada |

A classificação é heurística de reconhecimento conservadora; não é um classificador probabilisticamente calibrado nem um entendimento geral aberto.

## 3. Conhecimento institucional e personalidade

Fonte documental: docs/EMPROVEX_AI_MEMORIAL_OFICIAL.md na PR #455. A matriz R1 inspira elegância, objetividade, honestidade epistêmica, empatia moderada, firmeza e humor discreto; não reproduz identidade ou falas de Donna Paulsen.

O catálogo versionado em lib/emprovex-ai/conversation/knowledge.ts contém id, tema, perguntas relacionadas, fonte, visibilidade (public/sector/admin), versão, disponibilidade, restrições e referências. approvedPublicAnswer só devolve conteúdo explicitamente público e documentalmente verificado; dados planejados, comerciais sem fonte vigente ou administrativos retornam ausência de resposta.

As respostas locais autorizadas incluem identidade de Eleonor, sua inspiração e o propósito geral do EMPROVEX. Autoria do projeto, preços, produtos em desenvolvimento, capacidade técnica habilitada e regras de retenção dependem de fonte institucional atualizada e autorizada. Não foi criado catálogo paralelo com tutoriais privados.

A camada de estilo: presentAiResponse() W3 segue íntegra; o estilo W7 atua nas respostas conversacionais, sem tocar valores, resultados, ressalvas, escopo ou proveniência de W3.

## 4. Contexto e privacidade

- Reutiliza o token AES-256-GCM + HMAC W5, vinculado a UID, workspace e sessão HttpOnly; TTL de 10 minutos.
- Campo opcional conversation: {topic, intent}, com enum fechado e tamanho validado, sem mensagens completas, resultados, histórico, usuários ou dados pessoais.
- Troca para conversa casual descarta referências de NE/material/fornecedor do token anterior. Expiração elimina o assunto; token adulterado e intersetorial são recusados.
- Sem conversas persistidas em Firestore ou log de prompts por este módulo. Isto não autoriza prometer ausência de registros em toda infraestrutura.
- Autenticação e billing ocorrem antes do roteamento social.

## 5. LFM3 criativo (opt-in independente)

- W6 usa LFM3 para MODEL_ELIGIBLE operacional somente quando as guardas originais autorizam.
- W7 só usa resposta criativa quando todos os gates W6 estão válidos e EMPROVEX_AI_W7_GENERATIVE_ENABLED=1. Padrão: desligado.
- Mesmo com esse flag, mantém Cloud Run restrito a emprovex-ai-w6-homologation. Não altera produção, IAM, serviço de inferência, configuração de Ollama ou limites existentes de W6.
- LLM recebe apenas mensagem genérica avaliada pelo roteador, nunca tokens, workspace, resultados W3 nem histórico operacional. think=false, stream=false, JSON com answer:string, limite de 160 tokens, timeout de oito segundos e máximo 900 caracteres.
- Texto do modelo não vira consulta, filtro, comando ou mutação. JSON inválido, IAM negado, timeout e indisponibilidade resultam em fallback_unavailable.
- **Risco residual:** LFM3 1,7B não deve ser tratado como fonte factual, filtro geral de moderação ou gerador irrestrito. Revisar casos sensíveis antes de ativar esse flag.

## 6. Testes e evidência

Arquivo focal: scripts/emprovex-ai-w7.test.mjs, com perguntas sintéticas, variações de linguagem, precedência W4/W3, redação versus mutação, conhecimento incerto, matemática, continuidade, expiração, token adulterado, isolamento de setores, opt-in e falha do LFM3. Workflow isolado: .github/workflows/emprovex-ai-w7.yml, contendo npm ci, TypeScript, testes W7 e regressão W5/W6.

Os casos são sintéticos, sem Firebase/Firestore/GCP real. Resultados finais devem ser copiados dos checks reais da PR; não interpretar testes escritos como testes aprovados. O percentual de acerto na amostra não equivale a uma estimativa estatística de generalização. Uma avaliação futura deverá reservar holdout independente e testar linguagem natural de usuários.

## 7. Handoff E-P1 (matriz R2)

Quando a pesquisa R2 estiver pronta: comparar estilos e limites com PR #455, revisar frases autorizadas, ampliar casos inéditos, homologar mudança isolada. Não modificar branch E-P1 e não substituir decisões de segurança por texto narrativo.

## 8. Situação de publicação

W7 permanece isolado em feat/emprovex-ai-r2-w7-conversational-context e não realiza merge, deploy nem mudança de tráfego. O executor operacional e a interface da PR #453 não foram alterados diretamente. O bloqueio de homologação W6 continua obrigatório.
