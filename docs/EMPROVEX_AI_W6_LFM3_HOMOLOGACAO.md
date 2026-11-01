# EMPROVEX AI — W6 R0 — homologação isolada Cloud Run / LFM3

**Estado:** código em PR DRAFT #450, base PR #446. **Deploy do W6 ainda não realizado.**
Nenhuma promoção da `main`, alteração do Ollama ou de dados operacionais é autorizada por este memorial.

## Contrato de isolamento

- Projeto: `gen-lang-client-0982077967`; região `southamerica-east1`.
- **Novo serviço exclusivo:** `emprovex-ai-w6-homologation` (Cloud Run privado, sem invocadores públicos, mínimo 0 e máximo 1 instância).
- **Serviço existente de inferência — somente invocação:** `emprovex-ai-inference`, modelo `lfm3:1.7b-q4_K_M`. Não alterar imagem, CPU, RAM, escala ou configuração do Ollama.
- Não usar os serviços existentes de produção, `emprovex-cloudrun-candidate` ou staging para validar o W6.
- Criar/selecionar **identidade runtime dedicada e mínima**, sem acesso a dados operacionais reais. Não reutilizar indiscriminadamente a identidade da produção; habilitar Firestore apenas para **fixtures isoladas**, se necessário.
- Credencial Google: token de identidade obtido pelo **Metadata Server** do Cloud Run com audience igual à URL do serviço de inferência. **Proibido** usar chave JSON.
- Para permitir a invocação privada, a identidade da candidata precisa ter `roles/run.invoker` sobre `emprovex-ai-inference`. **Verificar a política vigente; não modificá-la automaticamente.** Se a autorização estiver ausente, registrar bloqueio real e obter aprovação específica.
- Não incluir as variáveis de cobrança nem segredos financeiros de produção.

## Variáveis exigidas apenas na candidata

| Variável | Valor |
|---|---|
| `EMPROVEX_AI_W45_ENABLED` | `1` |
| `EMPROVEX_AI_HOMOLOGATION_ENABLED` | `1` |
| `EMPROVEX_AI_LFM3_ENABLED` | `1` |
| `EMPROVEX_AI_LFM3_URL` | URL HTTPS `*.run.app` **real** obtida de `emprovex-ai-inference`, sem caminho |
| `EMPROVEX_AI_W45_CONTEXT_SECRET` | segredo **exclusivo de homologação**, armazenado no Secret Manager |
| `EMPROVEX_AI_CURSOR_SECRET` | segredo exclusivo de homologação para as consultas paginadas do W3 |

`K_SERVICE`, `K_CONFIGURATION` e `K_REVISION` são injetadas pelo Cloud Run. A aplicação verifica nome exato do serviço, configuração e prefixo da revisão. Um deploy em outro serviço **não libera** `/api/emprovex-ai/ask` ou `/query`, mesmo com flags ativas.

## Sequência mínima para homologação autorizada

1. Confirmar a PR #450 e o SHA de seu HEAD, e a certificação TypeScript + W6/W5 no GitHub.
2. Verificar em leitura a URL real de `emprovex-ai-inference`, a ausência de `emprovex-ai-w6-homologation` e o vínculo IAM `run.invoker` da nova identidade. Não mudar o serviço Ollama.
3. Construir a imagem **a partir do HEAD exato desta PR**, sem merge na `main`. Usar um tag/digest imutável e diferenciado dos releases de produção.
4. Com autorização GCP para esta PR e identidade separada, criar **apenas** `emprovex-ai-w6-homologation` com `--no-allow-unauthenticated`, sem domínio público próprio, escala 0–1, secrets independentes, sem tráfego dos serviços atuais.
5. Realizar teste privado autenticado com fixture sintética: a pergunta de fornecedor operacional ambígua deve acionar `MODEL_ELIGIBLE`, retornar a interpretação JSON do Ollama, passar pela validação W5, por `parseAiQuery()` e executar somente W3. **Não registrar prompts, ID tokens ou dados de clientes nos logs.**
6. Executar caso determinístico: `Quanto resta da NE 2026NE66?` (fixture). Esperado: `lfm3Calls=0`. Repetir modelo com endpoint artificialmente indisponível **somente na candidata**: esperado `fallback_unavailable`, zero consultas W3 via fallback.
7. Reutilizar a homologação de dois setores, Auth/Firestore emulados da PR #446; complementar com W6 usando a mesma fixture e confirmar separação de workspace, autenticação de tokens e rejeição de filtros não representáveis.
8. Documentar apenas evidências reais: revisão privada, SHA, status IAM, resultados e falhas. **Não promover para produção.**

## Bloqueios conhecidos

- A conexão disponível neste chat executa mudanças no GitHub, mas **não oferece API autenticada do GCP Cloud Run** para criar/verificar a candidata.
- Os fluxos GitHub WIF de release identificados estão vinculados à `main` e ao serviço candidato de produção. Não reutilizar nem ampliar automaticamente suas permissões para implantar esta branch DRAFT.
- A URL real do serviço de inferência, as permissões efetivas da identidade da nova candidata e o acesso a fixtures no ambiente privado ainda exigem verificação GCP.
- Testes sintéticos do cliente e regressões W3–W5 **não substituem uma chamada real de serviço para serviço no Cloud Run**.

**Critério de fechamento:** CI focal PASS + revisão privada operacional + IAM real PASS + execução sintética W4/W5 → LFM3 → W3 PASS + fallback e isolamento PASS. Até lá, manter DRAFT.
