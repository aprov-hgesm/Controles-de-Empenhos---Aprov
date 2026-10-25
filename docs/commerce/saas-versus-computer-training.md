# EMPROVEX — Separação entre assinatura SaaS e treinamento de informática

**Situação:** proposta de configuração comercial, **não habilitada em produção**  
**Data de referência:** 2026-10-25  
**Escopo:** faturamento, oferta, documentação comercial e elegibilidade da conta recebedora  
**Princípio:** GOV-SIMP-01 — simplicidade com segurança suficiente

## 1. Natureza efetiva da oferta existente

O EMPROVEX atualmente oferece acesso contínuo, por workspace, a ferramentas operacionais de gestão de empenhos, notas fiscais e depósitos, mediante o **Plano Completo de R$ 70/mês**. O código e os Termos de Serviço identificam essa oferta como **SaaS**.

Não transformar a assinatura existente em "treinamento em informática" apenas mudando descrição, nome de produto, checkout, nota fiscal ou titular da conta recebedora. CNAE, contrato, publicidade, serviço entregue e documento fiscal devem corresponder à atividade real.

Referências de código verificadas:
- `lib/billing.ts` — plano, competências, trial e VIP.
- `app/terms/page.tsx` — descrição como SaaS e Plano Completo.
- `app/regularizacao/page.tsx` — regularização da assinatura.
- `app/privacy/page.tsx` — tratamento de dados de usuários e workspaces.

## 2. Duas ofertas distintas (se a segunda for efetivamente criada)

### A. Assinatura EMPROVEX (software)

- Natureza atual: acesso recorrente às funcionalidades do software.
- Preço atual: R$ 70/mês por workspace, salvo isenções e condições contratuais.
- Não atribuir automaticamente ao CNAE 8599-6/03.
- Enquadramento empresarial, tributário e fiscal a confirmar por profissional habilitado; considerar as descrições do IBGE para disponibilização de programa na internet (6319-4/00) e desenvolvimento/licenciamento (62.02-3/00 e 62.03-1/00), conforme a operação concreta.
- Não ativar novas cobranças em conta empresarial cujo cadastro não esteja habilitado à atividade efetiva.

### B. Treinamento de informática aplicado ao EMPROVEX (produto futuro e separado)

Somente oferecer como treinamento real, com:
- Programa de ensino definido, conteúdo pedagógico e objetivos de aprendizagem.
- Aulas, tutoriais estruturados, atividades ou acompanhamento efetivamente entregues.
- Evidência de prestação do serviço educacional e condições de acesso correspondentes.
- Contrato, checkout e documento fiscal descrevendo **o treinamento efetivamente contratado**.
- Software de demonstração/ambiente de prática apenas quando genuinamente acessório à formação, sem camuflar licença operacional autônoma.
- Preço e condições comerciais próprios, aprovados e publicamente descritos com transparência.

A existência desse produto educacional **não transforma** a assinatura operacional vigente em treinamento. Pacotes que combinem os dois exigem análise fiscal sobre itens, faturamento e segregação de receitas; não classificar a totalidade como ensino por conveniência.

## 3. Titular da conta de recebimento

- Receber em CPF ou CNPJ **não define** a natureza tributária da receita.
- Conta pessoal ou MEI pode ter regras de elegibilidade específicas no provedor de pagamento.
- A pessoa/empresa recebedora deve possuir titularidade legítima da venda, do contrato, da cobrança e do documento fiscal, com poderes/direitos adequados sobre o produto e responsabilidades operacionais reais.
- Caso o operador da empresa seja familiar de militar da ativa, verificar com assessoria jurídica o art. 29 da Lei 6.880/1980, inclusive o risco de administração de fato por terceiro; a titularidade familiar não afasta automaticamente restrições.
- Nunca inserir dados pessoais, CNPJ, tokens, contas bancárias ou credenciais neste repositório público.

## 4. Condições para ativação comercial

**Bloqueado:** emitir cobrança ou nota de "treinamento" para o Plano Completo quando o objeto real do pagamento é uso operacional do SaaS.

**Pode ser preparado:** produto de treinamento **novo, efetivo e distinto**, com conteúdos, termos, entregas e cobrança própria, após confirmação contábil de enquadramento e emissão fiscal.

**Pendente de validação externa:** qual pessoa jurídica é a fornecedora legal do SaaS; CNAE e tributação; direitos de exploração/licenciamento; titularidade do meio de pagamento; regras funcionais aplicáveis; documentação contratual; exigências da plataforma de checkout.

## 5. Guardas técnicos para futura integração

- Manter `billingAccounts`, `billingCycles`, `platformBillingConfig` e o Plano Completo de R$ 70 sem alteração.
- Se houver produto educacional distinto, modelar seu tipo de oferta e seus registros financeiros **separadamente** da assinatura operacional; não sobrescrever histórico.
- Não usar e-mail ou comprovante como prova exclusiva de liquidação; validar pagamento pelo servidor, autenticar notificação, assegurar idempotência e reconciliação.
- Não habilitar suspensão automática de clientes nem modificar regras de acesso nesta etapa.
- Preservar isenções de fundador e VIPs legados.
- Checkout, conta recebedora e fornecedor de pagamentos somente após a aprovação e as credenciais adequadas; nada de alterações em produção como parte desta proposta.

## 6. Critério de aceite

1. Descrição da oferta, prestação efetiva, contrato, checkout e nota fiscal são coerentes.
2. Enquadramento e emissor fiscal revisados por contador; situação funcional relevante revisada com profissional jurídico.
3. Identidade empresarial, autorização de exploração do software e credenciamento no provedor confirmados.
4. Integração financeira testada com identidade por workspace, confirmação autenticada, falhas, reembolsos, eventos duplicados e recuperação.
5. Nenhuma mudança de produção sem auditoria e autorização explícita.

## 7. Fontes oficiais para a revisão

- Portal do Empreendedor, ocupações MEI: https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei/quais-as-ocupacoes-que-podem-ser-mei
- IBGE — treinamento em informática: https://cnae.ibge.gov.br/?classe=85996&tipo=cnae&versao=9&view=classe
- IBGE — programas disponibilizados na internet: https://cnae.ibge.gov.br/?subclasse=6319400&tipo=cnae&versao=&view=subclasse
- IBGE — desenvolvimento/licenciamento não customizável: https://cnae.ibge.gov.br/?subclasse=6203100&tipo=cnae&versao=&view=subclasse
- Lei 6.880/1980, art. 29: https://www.planalto.gov.br/ccivil_03/leis/l6880compilada.htm

> Documento preparatório; não constitui autorização comercial, fiscal, jurídica ou de deploy. Não substitui consulta profissional.
