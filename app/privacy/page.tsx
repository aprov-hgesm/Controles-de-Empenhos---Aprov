import type { Metadata } from 'next';

import { LegalSection, PublicLegalLayout } from '../../components/legal/PublicLegalLayout';
import { CURRENT_LEGAL_BUNDLE } from '../../lib/legalVersions';

export const metadata: Metadata = {
  title: 'Política de Privacidade | EMPROVEX',
  description: 'Tratamento de dados pessoais, informações institucionais, pagamentos, segurança e integrações do EMPROVEX.',
};

export default function PrivacyPage() {
  return (
    <PublicLegalLayout
      eyebrow="Privacidade e proteção de dados"
      title="Política de Privacidade"
      description="Esta Política explica como o EMPROVEX trata dados de usuários, dados operacionais, registros técnicos e dados autorizados por serviços integrados."
      updatedAt="27 de outubro de 2026"
      version={CURRENT_LEGAL_BUNDLE.privacyVersion}
    >
      <LegalSection title="1. Sobre o EMPROVEX e esta Política">
        <p>
          O EMPROVEX é uma plataforma de gestão logística e financeira para Setores de Aprovisionamento
          de Organizações Militares. Esta Política distingue dados pessoais dos usuários, informações
          operacionais de caráter institucional e registros técnicos necessários à execução e
          proteção do serviço, identificando finalidades, serviços externos e canais de solicitação.
        </p>
        <p>
          Os papéis de controlador e operador de dados e a base legal variam conforme a operação e
          a relação institucional aplicável. Não se presume que cada militar seja proprietário
          dos registros da Organização Militar, e o aceite dos Termos não significa que todo tratamento de dados pessoais dependa de consentimento.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados de conta, workspace e operação">
        <p>
          Conforme a funcionalidade utilizada, o EMPROVEX pode tratar nome, e-mail,
          identificação funcional informada, identificador técnico do Firebase Authentication,
          vínculo com workspace e Unidade Gestora, estado da conta, registros de sessão e acesso
          e dados necessários à autenticação, autorização e separação dos ambientes.
        </p>
        <p>
          Os registros institucionais podem abranger empenhos, fornecedores, itens, notas fiscais,
          comissões de recebimento, cronogramas, relatórios, configurações, controle de materiais,
          operações da Central de Depósitos, movimentações móveis e documentos anexados ou gerados.
          O armazenamento desses dados não transfere ao EMPROVEX sua titularidade institucional.
        </p>
      </LegalSection>

      <LegalSection title="3. Dados comerciais, logs, auditoria e backup">
        <p>
          Na administração da assinatura por workspace, o EMPROVEX pode tratar situação de trial,
          condição contratual, competências e valores devidos, referências de pedidos e transações,
          estado de pagamento, conferências de regularização, exceções financeiras,
          isenções e histórico administrativo pertinente.
        </p>
        <p>
          Logs, eventos de auditoria, trilhas técnicas, telemetria e registros de segurança podem ser utilizados
          para rastreabilidade, prevenção de abuso, diagnóstico, suporte e continuidade.
          Backups podem conter registros operacionais e pessoais e obedecem às limitações e controles
          efetivamente implementados; esta Política não constitui garantia de recuperação integral ou prazo fixo.
        </p>
      </LegalSection>

      <LegalSection title="4. Finalidades e bases legais">
        <p>
          Os dados são utilizados para autenticar usuários, separar workspaces, executar funcionalidades contratadas,
          produzir documentos e relatórios, manter segurança e auditoria, oferecer suporte, administrar o ciclo
          comercial, cumprir obrigações aplicáveis e preservar a continuidade operacional.
        </p>
        <p>
          O tratamento pode se apoiar em diferentes bases legais previstas na legislação brasileira, conforme o caso.
          Esta Política não presume que consentimento seja a base jurídica de todas as operações.
        </p>
      </LegalSection>

      <LegalSection title="5. Google Drive, Gmail e dados do Google">
        <p>
          A conexão com o Google Drive é opcional e ocorre somente quando um usuário autorizado escolhe conectar a
          Conta Google correspondente ao workspace. O EMPROVEX solicita o escopo
          <strong> drive.file</strong>, destinado ao acesso a arquivos criados ou utilizados pelo próprio aplicativo,
          em vez de acesso amplo a todo o conteúdo do Drive.
        </p>
        <p>
          O EMPROVEX pode criar e utilizar pastas destinadas aos documentos do workspace e manipular arquivos que o
          aplicativo criar ou aos quais o usuário conceder acesso. No fluxo atual, o token de acesso do Drive é tratado
          como autorização temporária e não é persistido em Firestore, banco de dados ou armazenamento local do
          navegador.
        </p>
        <p>
          Quando o usuário escolhe enviar um cronograma por e-mail, o EMPROVEX pode solicitar separadamente o escopo
          <strong> gmail.send</strong>, exclusivamente para enviar a mensagem e o PDF em nome da Conta Google
          autorizada. O EMPROVEX não solicita leitura da caixa de entrada para essa funcionalidade, e a autorização do
          Gmail permanece temporária no fluxo atual.
        </p>
        <p>
          Dados obtidos das APIs do Google são usados para fornecer as funcionalidades descritas, não são vendidos,
          utilizados para publicidade comportamental nem empregados para treinamento de modelos de inteligência
          artificial pelo EMPROVEX.
        </p>
      </LegalSection>

      <LegalSection title="6. Pagamentos pela InfinitePay e regularização">
        <p>
          O EMPROVEX oferece checkout externo pela InfinitePay para mensalidades vinculadas
          ao <strong>workspace/setor</strong>, com os meios habilitados pelo provedor, como Pix
          ou cartão. O EMPROVEX não armazena números de cartão, CVV ou credenciais de pagamento.
          Também não utiliza o retorno do checkout como prova suficiente de quitação.
        </p>
        <p>
          As informações informadas diretamente no checkout são tratadas pelo provedor
          conforme sua política. O EMPROVEX pode conservar metadados de conciliação,
          como pedido, competência, valor, meio utilizado, identificador técnico e momento
          de confirmação, além de registros das solicitações de acesso temporário e
          de tratamento de divergências ou cobranças duplicadas.
        </p>
      </LegalSection>

      <LegalSection title="7. Fornecedores de infraestrutura e serviços integrados">
        <p>
          O EMPROVEX utiliza Firebase e Google Cloud para autenticação, banco de dados, segurança e serviços de nuvem,
          além da Vercel para hospedagem e execução da aplicação. Google Drive e Gmail são utilizados apenas quando as
          integrações correspondentes forem autorizadas pelo usuário.
        </p>
        <p>
          A InfinitePay é o provedor externo de checkout de mensalidades quando a função está habilitada. Esses fornecedores tratam dados
          necessários à prestação de seus serviços conforme os contratos, termos e políticas aplicáveis a cada
          plataforma.
        </p>
      </LegalSection>

      <LegalSection title="8. Segurança, isolamento e acesso">
        <p>
          O serviço utiliza Firebase Authentication, isolamento lógico no Firestore por
          workspace, verificação de permissões e registros de auditoria nos fluxos aplicáveis.
          Contas externas usam e-mail e senha; o acesso fundador utiliza autenticação Google
          segundo a configuração vigente. A autenticação não autoriza acesso aos dados
          de outra Organização Militar ou Unidade Gestora.
        </p>
        <p>
          Nenhum mecanismo elimina completamente riscos de segurança. Incidentes relevantes são tratados conforme os
          procedimentos técnicos e obrigações aplicáveis ao caso.
        </p>
      </LegalSection>

      <LegalSection title="9. Retenção, cancelamento e exclusão">
        <p>
          Dados podem ser mantidos enquanto necessários para operação do workspace, execução do serviço, segurança,
          rastreabilidade administrativa, backup, recuperação e cumprimento de obrigações legais ou institucionais.
          Prazos específicos podem variar conforme a categoria do dado e a finalidade.
        </p>
        <p>
          Suspensão financeira, cancelamento e exclusão são procedimentos distintos: a falta
          de pagamento não autoriza reter coercitivamente informações do próprio setor nem
          determina exclusão automática. Pedidos de exclusão são examinados segundo a LGPD,
          as atribuições da instituição, as necessidades de auditoria e os deveres de
          guarda, inclusive de documentos públicos e de cópias de segurança.
        </p>
        <p>
          Arquivos mantidos no Google Drive permanecem sujeitos à conta e às permissões do usuário, podendo exigir ação
          própria no Drive para exclusão definitiva.
        </p>
      </LegalSection>

      <LegalSection title="10. Direitos do titular e solicitações">
        <p>
          O titular pode solicitar, conforme a LGPD e a situação concreta, confirmação de tratamento, acesso, correção,
          informações sobre compartilhamento, bloqueio, anonimização, portabilidade, eliminação quando aplicável e
          outras medidas previstas em lei.
        </p>
        <p>
          Alguns pedidos podem não resultar em exclusão imediata quando houver obrigação legal, necessidade de
          conservação ou outra hipótese legítima aplicável. O pedido será analisado conforme o contexto do tratamento.
        </p>
      </LegalSection>

      <LegalSection title="10.1. Recuperação de dados institucionais">
        <p>
          O responsável devidamente autorizado pela Organização Militar poderá solicitar a
          disponibilização dos dados operacionais do próprio setor, inclusive após suspensão
          ou encerramento comercial, sem cobrança adicional apenas por seu fornecimento.
          A solicitação depende de comprovação adequada da identidade e da autorização,
          respeita o sigilo, a privacidade e o isolamento entre workspaces e não implica
          acesso às informações de outros setores.
        </p>
        <p>
          A disponibilização seguirá procedimento e formato compatíveis com os recursos
          existentes e as obrigações institucionais; não se declara a existência de exportação
          automática. Os direitos pessoais de titulares, previstos na LGPD, são avaliados
          separadamente dos pedidos administrativos sobre registros do setor.
        </p>
      </LegalSection>

      <LegalSection title="11. Revogação de autorizações do Google">
        <p>
          O usuário pode deixar de conectar o Google Drive, deixar de autorizar o envio pelo Gmail e revogar a
          autorização concedida ao aplicativo nas configurações da própria Conta Google. A revogação impede novos
          acessos usando aquela autorização, sem necessariamente excluir arquivos já armazenados no Drive.
        </p>
      </LegalSection>

      <LegalSection title="12. Atualizações e versão desta Política">
        <p>
          Esta Política pode ser atualizada para refletir mudanças na plataforma, fornecedores, permissões solicitadas
          ou requisitos aplicáveis. A versão e a data vigentes permanecem visíveis nesta página. Quando uma atualização
          integrar um novo pacote legal exigido, o EMPROVEX poderá solicitar novo aceite da versão atualizada.
        </p>
      </LegalSection>

      <LegalSection title="13. Contato">
        <p>
          Dúvidas, solicitações de privacidade ou questões relacionadas ao uso de dados podem ser encaminhadas para
          <strong> aprov1hgesm@gmail.com</strong>.
        </p>
      </LegalSection>

      <LegalSection title="14. Uso de dados das APIs do Google">
        <p>
          O uso de informações recebidas das APIs do Google pelo EMPROVEX observa a Google API Services User Data
          Policy e as regras aplicáveis às APIs do Google Workspace, incluindo requisitos de uso limitado e de
          transparência pertinentes às permissões solicitadas.
        </p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
