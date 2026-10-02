import type { Metadata } from 'next';

import { LegalSection, PublicLegalLayout } from '../../components/legal/PublicLegalLayout';
import { CURRENT_LEGAL_BUNDLE } from '../../lib/legalVersions';

export const metadata: Metadata = {
  title: 'Política de Privacidade | EMPROVEX',
  description: 'Política de Privacidade do EMPROVEX para o SaaS, dados operacionais, billing, logs e integrações opcionais.',
};

export default function PrivacyPage() {
  return (
    <PublicLegalLayout
      eyebrow="Privacidade e proteção de dados"
      title="Política de Privacidade"
      description="Esta Política explica como o EMPROVEX trata dados de usuários, dados operacionais, registros técnicos e dados autorizados por serviços integrados."
      updatedAt="1º de outubro de 2026"
      version={CURRENT_LEGAL_BUNDLE.privacyVersion}
    >
      <LegalSection title="1. Sobre o EMPROVEX e esta Política">
        <p>
          O EMPROVEX é uma plataforma oferecida como serviço para gestão logística e financeira de workspaces
          previamente autorizados. Esta Política descreve as categorias de dados tratadas, as finalidades principais,
          os fornecedores técnicos utilizados e os canais disponíveis para questões de privacidade.
        </p>
        <p>
          O enquadramento jurídico de cada tratamento depende da finalidade, do contexto e da base legal aplicável. O
          aceite dos Termos de Serviço não significa que todo tratamento de dados pessoais dependa de consentimento.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados de conta, workspace e operação">
        <p>
          Conforme a funcionalidade utilizada, o EMPROVEX pode tratar e-mail, identificador técnico do Firebase,
          vínculo com workspace e Unidade Gestora, estado da conta, registros de acesso, sessão e informações
          necessárias para autenticação e isolamento entre tenants.
        </p>
        <p>
          Também podem ser tratados dados operacionais inseridos pelos usuários, incluindo informações de empenhos,
          fornecedores, itens, notas fiscais, comissões de recebimento, cronogramas, relatórios, configurações do
          setor, movimentações logísticas e documentos anexados à plataforma.
        </p>
      </LegalSection>

      <LegalSection title="3. Dados comerciais, logs, auditoria e backup">
        <p>
          No contexto comercial, o EMPROVEX pode tratar metadados administrativos como situação de trial, estado da
          assinatura, vencimento, confirmação de regularização, referência textual de pagamento quando necessária e
          histórico de ações administrativas.
        </p>
        <p>
          Logs, eventos de auditoria, telemetria técnica, registros de segurança, status de backup e informações de
          recuperação podem ser tratados para rastreabilidade, prevenção de abuso, diagnóstico, continuidade do serviço
          e suporte. Backups podem conter dados já existentes no workspace e são protegidos segundo a arquitetura de
          recuperação adotada.
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

      <LegalSection title="6. Pagamentos externos e Mercado Pago">
        <p>
          No SaaS R1, o pagamento pode ser realizado fora do EMPROVEX por link do Mercado Pago, Pix ou outro meio
          externo informado. O EMPROVEX não precisa armazenar credenciais de cartão, CVV, senha ou token secreto de
          pagamento para esse modelo.
        </p>
        <p>
          Quando o usuário acessa um provedor externo de pagamento, os dados fornecidos diretamente naquele ambiente
          são tratados pelo respectivo provedor conforme seus próprios termos e políticas. O EMPROVEX pode conservar
          apenas metadados administrativos mínimos necessários para registrar a regularização comercial.
        </p>
      </LegalSection>

      <LegalSection title="7. Fornecedores de infraestrutura e serviços integrados">
        <p>
          O EMPROVEX utiliza Firebase e Google Cloud para autenticação, banco de dados, segurança e serviços de nuvem,
          além da Vercel para hospedagem e execução da aplicação. Google Drive e Gmail são utilizados apenas quando as
          integrações correspondentes forem autorizadas pelo usuário.
        </p>
        <p>
          O Mercado Pago pode ser utilizado como provedor externo de pagamento. Esses fornecedores tratam dados
          necessários à prestação de seus serviços conforme os contratos, termos e políticas aplicáveis a cada
          plataforma.
        </p>
      </LegalSection>

      <LegalSection title="8. Segurança, isolamento e acesso">
        <p>
          A plataforma aplica autenticação, vínculo de identidade, isolamento por workspace, regras de acesso no
          Firestore e registros de auditoria compatíveis com os fluxos implementados. Contas externas utilizam
          autenticação por e-mail e senha; o acesso fundador institucional utiliza Google conforme a configuração
          vigente.
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
          Cancelamento comercial ou suspensão de acesso não significam exclusão automática de dados. Solicitações de
          exclusão serão avaliadas separadamente, considerando direitos do titular e hipóteses legítimas ou obrigatórias
          de conservação.
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
