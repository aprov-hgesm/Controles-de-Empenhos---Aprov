# EMPROVEX — SaaS Maturity R1 | Worker 1
## Handoff comercial, contratual e privacidade — 27/10/2026

> **Estado:** implementação documental concluída na branch exclusiva; **NÃO TESTADO — NÃO VALIDADO — NÃO INTEGRADO À MAIN — PRODUÇÃO INALTERADA**.
> **Bloqueio para integração:** a nova versão legal proposta **não foi ativada**. As Firestore Rules atuais reconhecem explicitamente as versões antigas. Publicar os documentos atualizados sem coordenar a versão e as Rules pode gerar divergência entre conteúdo jurídico e aceite registrado.

### 1. Identificação e perímetro
- **Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **Branch:** `feat/saas-maturity-w1-commercial-legal-r1`.
- **SHA da main de origem:** `86a775485d4e0761d5baed02dbb275f1a4d132a6`.
- **Estado comercial de referência:** R4, ENFORCE, InfinitePay, workspace/setor, trial padrão de 30 dias quando concedido, isenções VIP e contratos legados preservados, liberação financeira após confirmação efetiva.
- **Commits da frente:** `62ed8379` (Termos, Privacidade e rodapé da landing); `ac0cf589` (clareza do aceite de preços no portal); `8c270b84` (versões R4 **propostas e inativas**); este documento em commit próprio.
- **Atividades deliberadamente não executadas:** testes, typecheck, lint, build, navegador/QA, CI manual, deploy, merge, PR, alterações no Firestore Rules, motores de cobrança, preços, auth ou dados de clientes.

### 2. Arquivos modificados
| Arquivo | Intervenção |
| --- | --- |
| `app/terms/page.tsx` | Contratação por workspace; plano progressivo; trial; InfinitePay; confirmação; suspensão/48h; titularidade e recuperação legítima de dados institucionais; apoio administrativo; distinções entre contas e usuários. |
| `app/privacy/page.tsx` | Categorias pessoais/institucionais/técnicas; Firebase/Auth/Firestore; operação comercial e InfinitePay; Google Drive/Gmail; guarda, backup e recuperação; direitos individuais e pedidos institucionais. |
| `components/billing/InfinitePayReadinessPanel.tsx` | Informação adicional antes do aceite do cronograma financeiro, com links aos documentos jurídicos e separação entre aceite contratual e pagamento. |
| `public/institucional/content.html` | Acesso aos Termos e à Política de Privacidade no rodapé da vitrine, sem divulgar faixas futuras de preço nas áreas promocionais. |
| `lib/legalVersions.ts` | Proposta `PROPOSED_LEGAL_BUNDLE_R4` **inerte**, no commit separado; `CURRENT_LEGAL_BUNDLE` permanece inalterado. |
| `docs/saas-maturity/W1_COMERCIAL_JURIDICO_R1.md` | Este handoff executivo. |

### 3. Inconsistências identificadas e tratamento
1. Os Termos citavam **Mercado Pago** em serviços de terceiros: substituído pela identificação correta do checkout **InfinitePay**, distinguindo meios de pagamento dos provedores.
2. Os Termos se referiam ao **SaaS R1** em pontos contratuais, sem refletir a operação R4: esclarecidos trial, progressão, cobrança por competência, confirmação do pagamento e acesso por setor.
3. A privacidade descrevia mensalidades como **individuais**, embora a contratação financeira seja por workspace: corrigido.
4. A ausência de cláusula explícita contra retenção coercitiva de dados poderia dar a entender que a mensalidade compra a informação: incorporada a diretriz do fundador.
5. Não havia diferenciação suficientemente clara entre **titular de dado pessoal**, **responsável institucional**, **workspace**, **conta contratante** e **usuário autorizado**: explicitada sem atribuir a cada militar a titularidade dos dados da OM.
6. O portal financeiro tinha o cronograma progressivo, mas sem remissão direta às páginas jurídicas na área de aceite: esclarecido, sem criar campos, etapas ou pop-ups.
7. O rodapé da landing tinha acesso ao produto sem links diretos às páginas legais: links adicionados; permanecem na vitrine apenas o **preço inicial R$ 29,90/mês** e o convite de teste, sem publicizar as faixas futuras.
8. As páginas jurídicas exibiam data de 01/10/2026 e dependem de aceite versionado que ainda está tecnicamente vinculado à versão dessa data: as páginas receberam data documental de 27/10 **somente na branch**, enquanto a proposta de versão correspondente foi mantida inativa até o Coordenador concluir a migração coordenada.

### 4. Política contratual refletida
- **Objeto:** assinatura de funcionalidades, serviços e operação do EMPROVEX para um **setor/workspace**; não licença individual obrigatória para cada militar; condições específicas devem respeitar permissões técnicas efetivamente ofertadas.
- **Plano progressivo para novos contratos elegíveis:** meses pagos 1–3 R$ 29,90; 4–6 R$ 39,90; 7–9 R$ 49,90; 10–12 R$ 59,90; mês 13+ R$ 69,90. O trial não integra os meses pagos. Todos os valores permanecem exibidos antes do aceite financeiro **em área autenticada**, além de registrados nos Termos jurídicos; não foram adicionados ao marketing público.
- **Contratos legados/VIP:** condições existentes preservadas, sem recálculo ou reajustamento retroativo.
- **Checkout:** InfinitePay; pagamento efetivamente confirmado, e não apenas iniciado, redirecionado ou pendente. Pedido duplicado e reembolso requerem apuração; nenhuma restituição automática prometida. Não há débito recorrente automático pela simples aceitação.
- **Suspensão:** pode atingir funções operacionais do setor elegível por falta de regularização. Solicitação excepcional de até 48h conforme condições de elegibilidade **não constitui quitação nem concessão automática**. Restrições de segurança são tema distinto.
- **Procedimentos militares:** software de apoio; não substitui controle oficial, decisão administrativa, aprovação, conferência ou responsabilidade funcional.

### 5. Diretriz de dados — deliberação do fundador
A assinatura **remunera o software e seus serviços, não a propriedade dos dados**. Registros institucionais permanecem sujeitos à titularidade, à guarda, às normas e às autorizações da OM, sem presumir propriedade individual de cada operador. Suspensão financeira ou encerramento não autorizam retenção coercitiva de informações do próprio setor. Responsável legitimamente autorizado pode solicitar fornecimento dos dados operacionais do workspace sem cobrança adicional **apenas pela disponibilização dessas informações**, observadas identidade, sigilo, proteção de dados pessoais, autorização institucional e obrigações de conservação.

**Limites expressos:** não foi construída ferramenta automática de exportação; não se garante formato único ou prazo fixo de entrega; não se afrouxam as Firestore Rules; não se permite acesso a outro workspace, escritas não autorizadas nem execução gratuita das funcionalidades. Dados armazenados em Google Drive seguem as permissões próprias da Conta Google. O pedido de recuperação pode ser dirigido ao contato de suporte indicado nas páginas.

### 6. Privacidade e limites da prova
A Política contempla Firebase Authentication, Firestore com segregação de workspaces, dados de logística/financeiros, metadados comerciais, InfinitePay, Google Drive com escopo `drive.file`, Gmail com escopo `gmail.send`, logs/auditoria/telemetria, backup, manutenção e obrigações de guarda. Não há promessa de ISO/certificação, disponibilidade integral, exclusão imediata, prazo fixo de retenção ou recuperação irrestrita.

Não se alterou o texto existente sobre uso limitado de dados obtidos das APIs Google nem se presume que a base legal de todo tratamento de dados pessoais seja consentimento. Os papéis de controlador e operador dependem da operação concreta e requerem revisão jurídica humana.

### 7. Versionamento e impacto sobre clientes existentes — **ATENÇÃO**
- Versões **atualmente ativas**, intocadas: `saas-r1-2026-10-01`, `terms-2026-10-01-r1` e `privacy-2026-10-01-r1`.
- Versões **preparadas, mas NÃO ATIVADAS:** `saas-r4-2026-10-27`, `terms-2026-10-27-r2` e `privacy-2026-10-27-r2`. Constante `PROPOSED_LEGAL_BUNDLE_R4`.
- A inspeção estática de `firestore.rules` evidenciou validação hardcoded em `legalAcceptance` para o bundle antigo, inclusive ID `{uid}__saas-r1-2026-10-01` e `allow get`. Alterar apenas `CURRENT_LEGAL_BUNDLE` faria o cliente procurar/criar um registro que as Rules atuais recusam. **Não promover a constante proposta isoladamente**.
- O contrato atual em `lib/legalAcceptance.ts` usa ID determinístico por `uid + bundle`, registro create-only e conferência de versão; `LegalAcceptanceGate` exige aceite para versão ativa. O mecanismo histórico não foi alterado.
- **Ação coordenada futura:** (a) revisar juridicamente conteúdo final; (b) definir estratégia de reaceite por todos os usuários elegíveis, incluindo VIPs e clientes legados, sem mudar preços; (c) preparar e certificar a mudança específica das Rules com leitura/criação para novo bundle, preservando aceite histórico imutável e isolamento; (d) ativar `CURRENT_LEGAL_BUNDLE` no mesmo ciclo controlado; (e) conferir UX, autenticação e aceite antes de uma eventual publicação. Este trabalho pertence ao Coordenador ou à frente de segurança autorizada.
- **Não é seguro integrar os textos de 27/10 e publicar mantendo a versão vigente antiga**, pois a documentação mostraria cláusulas materiais novas associadas a um aceite de 01/10. A branch é entregue para **revisão e composição**, não para merge/publicação automáticos.

### 8. Riscos que exigem avaliação especializada
1. Identificação formal do prestador/contratante, dados cadastrais e meios legais de contratação, sobretudo com OMs e agentes públicos.
2. Definição de controlador, operador, destinatários de dados, instrumentos aplicáveis e bases legais por categoria; eventual transferência internacional e suboperadores.
3. Política de retenção por classe documental, backup e eliminação; obrigações administrativas de guarda de documentos públicos.
4. Regras concretas para pedidos de acesso, autenticidade e delegação institucional após desligamento da equipe, além do tratamento de incidentes e solicitações de titulares.
5. Consequências consumeristas, fiscais, reembolsos, cancelamento e validade do aceite financeiro progressivo perante cada cliente.
6. Coerência entre conteúdo da data indicada e pacote legal ativado; revisão humana das cláusulas materiais antes de reaceite.

### 9. Próximas ações do Coordenador
**Primeiro:** revisar alterações documentais e versão proposta, especialmente preço progressivo, significado de mês pago, regras de 48h e autorização institucional de recuperação. **Segundo:** resolver a dependência das Rules e do aceite histórico antes de qualquer merge; combinar com trabalho de backup/recuperação real da frente paralela sem atribuir capacidades inexistentes ao EMPROVEX. **Terceiro:** executar posteriormente as verificações técnicas, jurídicas e de CI que foram expressamente excluídas desta worker. **Quarto:** somente após certificação e decisão explícita, integrar e seguir o procedimento de publicação do Memorial Oficial. Atualizar o Memorial consolidado nessa etapa, não nesta branch.

**Estado final desta Worker:** **NÃO TESTADO — NÃO VALIDADO — NÃO INTEGRADO À MAIN — PRODUÇÃO INALTERADA**.
