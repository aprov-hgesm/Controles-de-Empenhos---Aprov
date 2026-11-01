# Handoff — W7 R1-D — Fornecedores, Consulta de Itens e Materiais

**Expansão:** EMPROVEX Almoxarifado. **Situação:** implementação em PR DRAFT, sem merge ou publicação.
**Base imutável de partida:** W5 PR #441, commit `d89781d5347d04173af98bcc50c71d99bfb8f663`.
**Base consultada:** `main` em `4f803e5795109fc02a24cb2bb7eee12353ba1efe` (01/11/2026).
**Documento normativo:** `docs/EMPROVEX_ALMOXARIFADO_MEMORIAL_OFICIAL.md`; não editado.
**Diretriz:** GOV-SIMP-01. Integração de navegação reservada a W9.

## Entregas isoladas

- `features/almoxarifado/catalogo/catalogModel.ts`: projeções imutáveis de fornecedores, empenhos, itens e materiais; vínculos apenas pelo identificador explícito `Item.warehouseMaterialId`; compatibilidade de unidades conservadora e conversão explícita; distinção entre saldo de empenho e saldo físico.
- `features/almoxarifado/catalogo/catalogLoader.ts`: leitura do workspace autenticado (Firebase + contexto setorial previamente resolvido); conferência de UID, workspace, UG e modalidade antes/depois da carga; reutiliza `getEmpenhos`, `getSupplierContacts`, diretório global autorizado e repositórios Warehouse.
- `features/almoxarifado/catalogo/AlmoxCatalogoView.tsx`: painel de fornecedores (incluindo contatos, itens fornecidos, empenhos e saldo financeiro), consulta de itens e consulta física por depósitos/posições; modo de gestão de contatos reaproveita `FornecedoresView` existente sem alterar sua implementação.
- `scripts/emprovex-almox-w7-materials.test.mjs`: 13 casos sintéticos, cobrindo os 10 requisitos funcionais/regressivos.
- `.github/workflows/emprovex-almox-w7-r1.yml`: TypeScript, teste W7, regressões W1/W5 e build em CI, sem deploy.

## Invariantes e dados

1. Identidade e autorização **não** derivam de UG, querystring, endereço eletrônico ou código fornecido pela UI. O W9 só deve montar o módulo sob `WarehouseAccessBoundary`, com `SectorWorkspaceContext` confiável, `user` autenticado, `sectorType='almoxarifado'` e cobrança liberada.
2. `getEmpenhos(user.uid)` e `getSupplierContacts(user.uid)` usam o escopo operacional já validado. O catálogo Warehouse é buscado apenas para o mesmo `workspaceId`; qualquer entidade física com workspace/UG diferente causa falha fechada na projeção.
3. A UG pode ser a mesma e os workspaces distintos: **não** misturar dados.
4. O diretório global contém apenas dados permitidos pelo contrato existente; contatos privados continuam no workspace. Em conflito, o contato local prevalece.
5. Descrição/alias não vincula automaticamente item financeiro a material. Referência ausente, inativa ou com unidade incompatível é exibida como pendência, sem movimentação.
6. Quantidade empenhada/recebida/saldo financeiro são provenientes do empenho; quantidade localizada vem **somente** das posições físicas ativas do Warehouse. Não se soma apresentações distintas sem fator explícito; não se opera movimento a partir da consulta.
7. A consulta de localização usa `findWarehouseMaterialsAcrossDepots`, respeitando locais e subposições ativos. Não cria saldos, catálogos paralelos, Rules ou ledger.
8. Não foram alterados os fluxos W2/W3/W5, APIs, páginas, financeiro W6, relatórios W8, identidade, produção, SISCOFIS nem dados reais.

## Contrato para W9

Montar `AlmoxCatalogoView` somente após validação do acesso. Props obrigatórias:

```tsx
<AlmoxCatalogoView
  user={authenticatedUser}
  workspaceId={context.workspaceId}
  ug={context.ug!}
  section="fornecedores" // ou "consulta-itens", "materiais"
/>
```

- Renderizar as seções `fornecedores` e `consulta-itens` no portal existente; `materiais` pode virar subaba de Central de Depósitos, sem substituir a Central.
- Não fornecer `user` nulo, UG nula ou contexto de outra modalidade. Não editar o arquivo W7 para contornar o gate.
- As consultas são independentes de mudanças na navegação. O botão 'Gerenciar contatos' reutiliza o módulo existente (que executará gravações apenas se um usuário autorizado decidir salvar após publicação futura).

## Limites reais e riscos residuais

- **SISCOFIS:** documento real de Pedido de Material não fornecido; sem certificação de parser ou importação de pedidos reais. Mapa de Existência permanece intacto.
- **Leitura física:** consulta de saldos positivos limitada a 500 registros, posições a 500 e depósitos a 250; catálogo busca até 1000 materiais. Se um limite é atingido, a interface sinaliza cobertura parcial. Funções legadas de consulta Warehouse podem converter erros de leitura em `[]`; se essa limitação for crítica em campo, W9 deve introduzir erro explícito na camada de leitura homologada antes de rotular um total como exato.
- **Recebimento:** o campo `item.received` é o quantitativo financeiro existente; não equivale automaticamente à entrada logística e não serve de prova de baixa.
- **Cadastro de fornecedores:** reaproveita `FornecedoresView` e suas regras atuais de CNPJ/contatos. Revisar permissão de escrita em homologação; este W7 não modifica Firestore Rules.
- **Testes:** execução isolada configurada em GitHub Actions. Conferir conclusão real do run antes de aprovar a integração, e registrar sucesso/falhas com referência ao SHA. Nunca inferir sucesso pela presença da configuração.

## Parecer e próximos passos

**GO apenas para revisão e integração técnica W9, condicionado à conclusão verde dos testes. NO-GO para merge, publicação, dados reais ou afirmação de suporte a pedidos SISCOFIS reais.**

O integrador W9 consolidará o memorial compartilhado e fará o encaixe de navegação sem desfazer este isolamento.
