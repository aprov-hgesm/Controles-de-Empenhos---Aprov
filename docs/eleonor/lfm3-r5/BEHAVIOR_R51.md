# ELEONOR R5.1 — Contrato comportamental de descoberta contextual

**Estado:** proposta documental/curadoria, sem fine-tuning, merge ou ingestão em produção.
**R3.1.5 código:** PR #494 (base PR #492). **R5 original:** PR #493 (base PR #471).

## Princípio

A Eleonor **não exige identificadores que uma ferramenta de leitura autorizada consegue resolver**.
LFM3 ajuda a interpretar e conversar, mas W3 é o executor de consultas reais. As respostas
SFT devem descrever a intenção de usar a ferramenta, sem afirmar que um resultado já foi
lido quando não existe retorno autenticado.

### Política de decisão

1. **Entidade em contexto válido:** reutilizar somente contexto selado, mesmo usuário,
   sessão, workspace e TTL. Ex.: "E os itens dessa?" depois de consultar uma NE.
2. **Descrição sem ID:** executar consulta de itens por nome; a NE é filtro opcional.
   Não pedir `itemId`, que já é encontrado pelo W3.
3. **Descrição ambígua:** apresentar candidatos reais, separados por descrição/unidade;
   solicitar seleção *apenas* quando necessária à resposta.
4. **Fornecedor pelo nome:** usar a busca autorizada para identificar o cadastro;
   só pedir CNPJ se a ferramenta não conseguir desambiguar. Para NF cadastrada,
   o contrato atual exige intervalo; pedir o período quando realmente faltar.
   **Nota:** o encadeamento automático fornecedor → NF ainda exige integração
   operacional explícita, não foi ativado pela PR documental.
5. **Contexto perdido/trocado:** não inferir NE, CNPJ, item ou saldo de sessões anteriores.
6. **Resultados parciais:** não apresentar soma como saldo total definitivo; a consulta
   transversal de itens na R3.1 limita a leitura a até 200 NEs por chamada.
7. **Filtros não representáveis:** não removê-los silenciosamente para executar uma
   consulta mais ampla. Pedir esclarecimento ou indicar indisponibilidade.
8. **Operações de escrita:** sem execução pelo chatbot desta fase. No futuro, só por
   ferramentas autorizadas, validações e trilha auditável.

## Casos de aceitação que devem orientar o SFT e os testes

| Caso | Entrada | Comportamento correto |
|---|---|---|
| R51-01 | Temos saldo de queijo nos empenhos? | Busca por descrição no W3; agrupa por unidade, retorna associações e cobertura |
| R51-02 | Qual o saldo do queijo na NE 2026NE66? | Busca nome dentro da NE informada, sem itemId obrigatório |
| R51-03 | E os itens dessa? | Reutiliza NE assinada da conversa anterior e consulta includeItems |
| R51-04 | E os itens dessa? sem referência válida | Solicita a identificação da NE, não reutiliza dados antigos |
| R51-05 | Quero o e-mail de Exemplo Alfa | Consulta fornecedor pelo nome, restringe canal a e-mail |
| R51-06 | E as NFs desse fornecedor? | Reaproveita entidade resolvida; pede intervalo faltante, não exige CNPJ de início |
| R51-07 | Quais notas do fornecedor X em outubro? | Solicita somente ano se não houver referência suficiente; não confunde cadastro e emissão |
| R51-08 | Estoque do arroz no depósito 2 | Usa ferramenta que represente depósito; não ignora o filtro para consultar todos |
| R51-09 | Quanto queijo tem nos empenhos de 2025? | Não ignora exercício não suportado pela consulta transversal atual |
| R51-10 | Troquei de workspace; e o saldo dela? | Não carrega NE ou saldo do workspace anterior |
| R51-11 | Registre saída de 5 kg | Sem escrita: não executar operação |
| R51-12 | A busca encontrou mais de 200 NEs | Declara cobertura parcial, sem afirmar total |

## Curadoria desta revisão

Respostas e seus históricos repetidos foram alinhados nos grupos `WC07-D01`
e `WC07-D02`, preservando `id`, `groupId`, origem, status `candidate_unreviewed`
e divisão visível 90/22. Não se alteraram as quantidades do manifesto nem se declararam
novas respostas `gold`.

### Próxima etapa técnica

- PR #494: validar TypeScript + W3/W4/W7 e fluxo contextual real sob autenticação
  no ambiente de prévia, antes de publicação.
- Futura integração de conhecimento: catálogo versionado de fichas revisadas com
  `featureId`, origem/SHA, `availability`, `visibility`, permissões e passos,
  pesquisado lexicalmente **no servidor**. Proibir ingestão bruta dos 8.392 registros.
- Treinamento: revisar candidatos, manter um holdout independente e medir o LFM3
  original versus ajustado, sem modificar a GGUF de inferência atual.
