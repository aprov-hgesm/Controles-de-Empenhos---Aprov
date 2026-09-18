import type { Metadata } from 'next';

import { LegalSection, PublicLegalLayout } from '../../components/legal/PublicLegalLayout';

export const metadata: Metadata = {
  title: 'Política de Privacidade | EMPROVEX',
  description: 'Política de Privacidade do EMPROVEX, incluindo o tratamento de dados e a integração opcional com Google Drive.',
};

export default function PrivacyPage() {
  return (
    <PublicLegalLayout
      eyebrow="Privacidade e proteção de dados"
      title="Política de Privacidade"
      description="Esta Política explica como o EMPROVEX trata dados de usuários, dados operacionais e dados autorizados por meio de serviços Google quando você utiliza a plataforma."
      updatedAt="18 de setembro de 2026"
    >
      <LegalSection title="1. Sobre o EMPROVEX">
        <p>
          O EMPROVEX é uma plataforma de gestão logística e financeira destinada a setores previamente autorizados.
          Entre suas funcionalidades estão gestão de empenhos, notas fiscais, recebimentos, liquidação, cronogramas,
          relatórios, configurações por workspace e armazenamento documental.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados tratados">
        <p>
          Conforme a funcionalidade utilizada, o EMPROVEX pode tratar dados de identificação da conta, como e-mail,
          identificador técnico do Firebase, vínculo com o workspace, registros de acesso e status da conta.
        </p>
        <p>
          Também podem ser tratados dados operacionais inseridos pelos usuários, incluindo informações de empenhos,
          fornecedores, itens, notas fiscais, comissões de recebimento, cronogramas, relatórios, configurações do setor
          e documentos anexados à plataforma.
        </p>
      </LegalSection>

      <LegalSection title="3. Google Drive e dados do Google">
        <p>
          A conexão com o Google Drive é opcional e ocorre somente quando um usuário autorizado escolhe conectar a
          Conta Google correspondente ao workspace. O EMPROVEX solicita o escopo
          <strong> drive.file</strong>, que permite acessar apenas arquivos e pastas criados ou utilizados pelo próprio
          aplicativo, em vez de acesso amplo a todo o conteúdo do Drive.
        </p>
        <p>
          O EMPROVEX pode criar e utilizar pastas destinadas aos documentos do workspace e manipular arquivos que o
          próprio aplicativo criar ou aos quais o usuário conceder acesso. O token de acesso retornado pelo Google é
          tratado como autorização temporária e não é persistido em Firestore, banco de dados ou armazenamento local do
          navegador pelo fluxo atual de conexão do Drive.
        </p>
        <p>
          O EMPROVEX usa os dados obtidos das APIs do Google somente para fornecer as funcionalidades descritas nesta
          Política. Esses dados não são vendidos, utilizados para publicidade comportamental nem empregados para
          treinamento de modelos de inteligência artificial.
        </p>
      </LegalSection>

      <LegalSection title="4. Finalidades do tratamento">
        <p>
          Os dados são utilizados para autenticar usuários, separar os dados por workspace, executar fluxos de gestão
          logística e financeira, gerar documentos e relatórios, armazenar e recuperar arquivos, registrar auditoria
          operacional, manter a segurança da plataforma e prestar suporte.
        </p>
      </LegalSection>

      <LegalSection title="5. Compartilhamento e fornecedores de infraestrutura">
        <p>
          O EMPROVEX utiliza serviços técnicos necessários à operação da plataforma, incluindo Firebase/Google Cloud e
          Vercel. Quando a integração opcional com Google Drive é utilizada, o Google também processa dados conforme os
          termos e políticas aplicáveis à Conta Google do usuário.
        </p>
        <p>
          O EMPROVEX não comercializa dados pessoais. O acesso aos dados operacionais é limitado aos usuários
          autorizados do respectivo workspace e às operações técnicas necessárias para manter o serviço.
        </p>
      </LegalSection>

      <LegalSection title="6. Segurança e isolamento">
        <p>
          A plataforma aplica autenticação, vínculo por identidade, isolamento por workspace e regras de acesso no
          Firestore. Contas externas utilizam autenticação por e-mail e senha, enquanto o acesso fundador institucional
          utiliza Google, conforme a configuração de segurança do sistema.
        </p>
      </LegalSection>

      <LegalSection title="7. Retenção e exclusão">
        <p>
          Dados operacionais podem ser mantidos enquanto forem necessários ao funcionamento do workspace, à
          rastreabilidade administrativa e às obrigações institucionais aplicáveis. Arquivos mantidos no Google Drive
          permanecem na conta do usuário até que sejam excluídos pelo próprio usuário ou por uma ação autorizada do
          aplicativo.
        </p>
        <p>
          Solicitações de acesso, correção, exclusão ou outras medidas relacionadas a dados pessoais serão avaliadas
          conforme a LGPD e eventuais deveres legais ou institucionais de conservação de registros.
        </p>
      </LegalSection>

      <LegalSection title="8. Revogação do acesso ao Google">
        <p>
          O usuário pode deixar de conectar o Google Drive ao EMPROVEX e também pode revogar a autorização concedida ao
          aplicativo nas configurações de segurança da própria Conta Google. A revogação impede novos acessos usando a
          autorização revogada, sem necessariamente excluir arquivos que já estejam armazenados no Drive.
        </p>
      </LegalSection>

      <LegalSection title="9. Atualizações desta Política">
        <p>
          Esta Política pode ser atualizada para refletir mudanças na plataforma, nos fornecedores utilizados, nas
          permissões solicitadas ou em requisitos legais. A data da última atualização será mantida nesta página.
        </p>
      </LegalSection>

      <LegalSection title="10. Contato">
        <p>
          Dúvidas, solicitações de privacidade ou questões relacionadas ao uso de dados podem ser encaminhadas para
          <strong> aprov1hgesm@gmail.com</strong>.
        </p>
      </LegalSection>

      <LegalSection title="11. Uso de dados das APIs do Google">
        <p>
          O uso de informações recebidas das APIs do Google pelo EMPROVEX observará a Google API Services User Data
          Policy, incluindo os requisitos de Limited Use aplicáveis.
        </p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
