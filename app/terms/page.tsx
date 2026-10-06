import type { Metadata } from 'next';

import { LegalSection, PublicLegalLayout } from '../../components/legal/PublicLegalLayout';
import { CURRENT_LEGAL_BUNDLE } from '../../lib/legalVersions';

export const metadata: Metadata = {
  title: 'Termos de Serviço | EMPROVEX',
  description: 'Termos de Serviço do EMPROVEX para utilização do SaaS, trial, Plano Completo e serviços integrados.',
};

export default function TermsPage() {
  return (
    <PublicLegalLayout
      eyebrow="Condições de utilização"
      title="Termos de Serviço"
      description="Estes Termos estabelecem as condições para utilização do EMPROVEX como serviço por usuários e workspaces previamente autorizados."
      updatedAt="1º de outubro de 2026"
      version={CURRENT_LEGAL_BUNDLE.termsVersion}
    >
      <LegalSection title="1. Aceitação e versão dos Termos">
        <p>
          O uso do EMPROVEX depende da aceitação da versão vigente destes Termos e da Política de Privacidade quando
          essa aceitação for solicitada pela plataforma. O registro é associado à conta, ao workspace e à versão do
          pacote legal vigente.
        </p>
        <p>
          Uma nova aceitação somente será solicitada quando a versão legal exigida for alterada. O aceite contratual
          destes Termos não significa que todo tratamento de dados pessoais realizado pelo serviço tenha o consentimento
          como base legal.
        </p>
      </LegalSection>

      <LegalSection title="2. Serviço EMPROVEX e Plano Completo">
        <p>
          O EMPROVEX é um serviço de apoio à gestão logística e financeira, com ferramentas para empenhos, itens, notas
          fiscais, recebimentos, liquidação, cronogramas, relatórios, documentos, Central de Depósitos e demais
          funcionalidades disponibilizadas ao respectivo workspace.
        </p>
        <p>
          Na modalidade comercial inicial, o EMPROVEX utiliza um plano único denominado <strong>Plano Completo</strong>.
          O acesso às funcionalidades depende das permissões operacionais, do estado da conta e das condições comerciais
          aplicáveis ao workspace, sem diferenciação jurídica entre usuários pagantes e workspaces VIP/isentos.
        </p>
      </LegalSection>

      <LegalSection title="3. Trial e início da utilização">
        <p>
          O EMPROVEX pode conceder período de teste antes do início da cobrança. Na configuração comercial do SaaS R1,
          o período padrão é de 30 dias, salvo ajuste administrativo informado ao cliente. O encerramento do trial não
          implica exclusão automática dos dados do workspace.
        </p>
      </LegalSection>

      <LegalSection title="4. Cobrança externa, Mercado Pago e Pix">
        <p>
          O pagamento do serviço pode ocorrer fora do EMPROVEX por meio de link do Mercado Pago, Pix ou outro meio
          externo informado para regularização. O EMPROVEX não processa cartão diretamente e, no modelo SaaS R1, não
          precisa armazenar número de cartão, CVV, senha, token secreto ou credencial de pagamento do cliente.
        </p>
        <p>
          A plataforma pode manter apenas metadados administrativos necessários para acompanhar trial, vencimento,
          regularização e confirmação do pagamento. Quando o Mercado Pago for utilizado, o pagamento também estará
          sujeito aos termos, políticas e disponibilidade do próprio provedor.
        </p>
      </LegalSection>

      <LegalSection title="5. Contas, credenciais e acesso">
        <p>
          O acesso é restrito a usuários cadastrados ou expressamente autorizados. Cada usuário deve manter suas
          credenciais sob controle e não deve compartilhar senhas, tokens ou outros meios de autenticação.
        </p>
        <p>
          O usuário deve utilizar somente o workspace e a Unidade Gestora associados à sua identidade. Tentativas de
          contornar controles de acesso ou acessar dados de outro tenant são proibidas.
        </p>
      </LegalSection>

      <LegalSection title="6. Suspensão e reativação">
        <p>
          O acesso pode ser suspenso por razões comerciais, administrativas, de segurança ou por uso incompatível com
          estes Termos. Na fase inicial do SaaS, a suspensão comercial é uma ação administrativa explícita e não apaga
          os dados operacionais do workspace.
        </p>
        <p>
          Quando a causa da suspensão for sanada e as condições de acesso forem restabelecidas, a conta poderá ser
          reativada sem exigir recriação do workspace ou migração dos dados preservados.
        </p>
      </LegalSection>

      <LegalSection title="7. Cancelamento, preservação e exclusão de dados">
        <p>
          Cancelamento comercial e exclusão de dados são procedimentos diferentes. O cancelamento do serviço não
          significa exclusão automática de documentos, registros operacionais, logs, auditorias ou backups.
        </p>
        <p>
          A preservação e eventual exclusão de dados serão tratadas conforme a finalidade, as obrigações legais ou
          institucionais aplicáveis, as necessidades de rastreabilidade e as solicitações válidas do titular ou do
          responsável pelo workspace.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilidade pelos dados inseridos">
        <p>
          O usuário e a organização responsável pelo workspace devem assegurar a exatidão, legitimidade e adequação dos
          dados e documentos inseridos, cadastrados, anexados, gerados ou transmitidos por meio da plataforma.
        </p>
        <p>
          O EMPROVEX não substitui conferências, autorizações, controles internos, assinaturas, aprovações ou
          procedimentos administrativos exigidos pela organização do usuário.
        </p>
      </LegalSection>

      <LegalSection title="9. Uso permitido">
        <p>
          A plataforma deve ser utilizada para finalidades legítimas relacionadas às atividades autorizadas. É proibido
          tentar explorar vulnerabilidades, inserir código malicioso, utilizar credenciais de terceiros, contornar
          controles técnicos ou empregar o serviço de forma incompatível com a legislação ou com normas institucionais.
        </p>
      </LegalSection>

      <LegalSection title="10. Google Drive e Gmail">
        <p>
          O usuário pode optar por conectar o Google Drive para armazenamento e recuperação de documentos utilizados
          pelo EMPROVEX. A conexão depende de autorização específica da Conta Google e utiliza permissões limitadas às
          funcionalidades necessárias ao serviço.
        </p>
        <p>
          Quando a funcionalidade de envio de cronogramas por e-mail for utilizada, o usuário pode autorizar
          separadamente o envio pela Gmail API em nome da Conta Google do workspace. A disponibilidade dessas
          integrações também depende dos serviços e políticas do Google.
        </p>
      </LegalSection>

      <LegalSection title="11. Serviços de terceiros">
        <p>
          O funcionamento do EMPROVEX depende de serviços de terceiros, incluindo Firebase/Google Cloud, Vercel e,
          quando escolhidas pelo usuário, integrações Google e meios externos de pagamento como Mercado Pago e Pix.
          Cada serviço de terceiro possui termos, políticas e condições próprias.
        </p>
      </LegalSection>

      <LegalSection title="12. Disponibilidade, manutenção e incidentes">
        <p>
          São adotadas medidas razoáveis para manter o EMPROVEX disponível e seguro, porém não há promessa de
          disponibilidade absoluta ou operação ininterrupta. Atualizações, manutenção, incidentes, indisponibilidade de
          provedores, falhas de conectividade ou eventos fora do controle operacional podem causar interrupções
          temporárias.
        </p>
      </LegalSection>

      <LegalSection title="13. Documentos e decisões administrativas">
        <p>
          Relatórios, termos, consolidações, cálculos, cadastros e documentos gerados pelo EMPROVEX são ferramentas de
          apoio. A responsabilidade pela conferência final, assinatura, aprovação, conformidade administrativa e uso
          oficial permanece com os agentes e setores competentes.
        </p>
      </LegalSection>

      <LegalSection title="14. Propriedade intelectual">
        <p>
          A interface, código, identidade visual, documentação e demais elementos próprios do EMPROVEX permanecem
          protegidos pela legislação aplicável. O uso autorizado da plataforma não transfere direitos de propriedade
          intelectual ao usuário.
        </p>
      </LegalSection>

      <LegalSection title="15. Privacidade e proteção de dados">
        <p>
          O tratamento de dados pessoais, dados operacionais, registros de auditoria e dados provenientes de serviços
          integrados é descrito na Política de Privacidade do EMPROVEX, disponível publicamente no mesmo domínio.
        </p>
      </LegalSection>

      <LegalSection title="16. Alterações destes Termos">
        <p>
          Estes Termos podem ser atualizados para refletir mudanças funcionais, comerciais, técnicas ou legais. A
          versão e a data vigentes são exibidas nesta página. Quando a atualização exigir novo aceite, o EMPROVEX
          solicitará a aceitação da nova versão antes da continuidade do uso autenticado.
        </p>
      </LegalSection>

      <LegalSection title="17. Legislação aplicável">
        <p>
          Estes Termos são interpretados de acordo com a legislação brasileira, sem prejuízo de normas administrativas,
          regulamentos internos e demais regras específicas aplicáveis à organização ou ao setor usuário.
        </p>
      </LegalSection>

      <LegalSection title="18. Suporte e contato">
        <p>
          Dúvidas sobre estes Termos, regularização ou funcionamento do EMPROVEX podem ser encaminhadas para
          <strong> aprov1hgesm@gmail.com</strong>.
        </p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
