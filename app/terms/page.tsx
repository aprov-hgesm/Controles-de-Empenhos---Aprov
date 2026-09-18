import type { Metadata } from 'next';

import { LegalSection, PublicLegalLayout } from '../../components/legal/PublicLegalLayout';

export const metadata: Metadata = {
  title: 'Termos de Serviço | EMPROVEX',
  description: 'Termos de Serviço do EMPROVEX para usuários e setores autorizados.',
};

export default function TermsPage() {
  return (
    <PublicLegalLayout
      eyebrow="Condições de utilização"
      title="Termos de Serviço"
      description="Estes Termos estabelecem as condições para utilização do EMPROVEX por usuários e setores previamente autorizados."
      updatedAt="18 de setembro de 2026"
    >
      <LegalSection title="1. Aceitação dos Termos">
        <p>
          Ao acessar ou utilizar o EMPROVEX, o usuário declara estar autorizado a utilizar a plataforma em nome do
          respectivo setor e concorda em observar estes Termos, a Política de Privacidade e as normas institucionais
          aplicáveis à sua atividade.
        </p>
      </LegalSection>

      <LegalSection title="2. Finalidade do serviço">
        <p>
          O EMPROVEX oferece ferramentas para gestão de empenhos, itens, notas fiscais, recebimentos, liquidação,
          cronogramas, relatórios, documentos e outras rotinas de apoio logístico e financeiro.
        </p>
      </LegalSection>

      <LegalSection title="3. Contas e acesso">
        <p>
          O acesso é restrito a usuários cadastrados ou expressamente autorizados. Cada usuário deve manter suas
          credenciais sob controle e não deve compartilhar senhas, tokens ou outros meios de autenticação.
        </p>
        <p>
          O acesso pode ser suspenso ou revogado quando houver desligamento do setor, alteração de autorização,
          comprometimento de segurança, uso incompatível com estes Termos ou necessidade administrativa.
        </p>
      </LegalSection>

      <LegalSection title="4. Responsabilidade pelos dados inseridos">
        <p>
          O usuário é responsável pela exatidão, legitimidade e adequação dos dados e documentos que inserir,
          cadastrar, anexar, gerar ou transmitir por meio da plataforma. O EMPROVEX não substitui conferências,
          aprovações, controles internos ou procedimentos administrativos exigidos pela organização do usuário.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso permitido">
        <p>
          A plataforma deve ser utilizada exclusivamente para finalidades legítimas relacionadas às atividades
          autorizadas do setor. É proibido tentar contornar controles de acesso, acessar dados de outro workspace,
          explorar vulnerabilidades, inserir código malicioso, utilizar credenciais de terceiros ou empregar a
          plataforma de forma incompatível com a legislação ou com normas institucionais.
        </p>
      </LegalSection>

      <LegalSection title="6. Google Drive">
        <p>
          O usuário pode optar por conectar o Google Drive para armazenamento e recuperação de documentos utilizados
          pelo EMPROVEX. Essa conexão depende de autorização específica da Conta Google e utiliza permissões limitadas
          às funcionalidades necessárias ao serviço.
        </p>
        <p>
          A disponibilidade, autenticação e operação do Google Drive também estão sujeitas aos termos e políticas do
          Google. O usuário pode revogar a autorização concedida ao EMPROVEX nas configurações da Conta Google.
        </p>
      </LegalSection>

      <LegalSection title="7. Serviços de terceiros">
        <p>
          O funcionamento do EMPROVEX depende de serviços de terceiros, incluindo infraestrutura de nuvem,
          autenticação, armazenamento e hospedagem. Interrupções ou alterações desses serviços podem afetar
          temporariamente determinadas funcionalidades da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilidade e manutenção">
        <p>
          São adotadas medidas razoáveis para manter o serviço disponível e seguro, porém não é garantida operação
          ininterrupta. Atualizações, manutenção, incidentes, indisponibilidade de provedores ou eventos fora do
          controle operacional podem causar interrupções temporárias.
        </p>
      </LegalSection>

      <LegalSection title="9. Documentos e decisões administrativas">
        <p>
          Relatórios, termos, consolidações, cálculos, cadastros e documentos gerados pelo EMPROVEX são ferramentas de
          apoio. A responsabilidade pela conferência final, assinatura, aprovação, conformidade administrativa e uso
          oficial permanece com os agentes e setores competentes.
        </p>
      </LegalSection>

      <LegalSection title="10. Propriedade intelectual">
        <p>
          A interface, código, identidade visual, documentação e demais elementos próprios do EMPROVEX permanecem
          protegidos pela legislação aplicável. O uso autorizado da plataforma não transfere direitos de propriedade
          intelectual ao usuário.
        </p>
      </LegalSection>

      <LegalSection title="11. Privacidade">
        <p>
          O tratamento de dados pessoais e de dados provenientes de serviços Google é descrito na Política de
          Privacidade do EMPROVEX, disponível publicamente no mesmo domínio da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="12. Alterações">
        <p>
          Estes Termos podem ser atualizados para acompanhar mudanças funcionais, técnicas, institucionais ou legais.
          A versão vigente será disponibilizada nesta página com a respectiva data de atualização.
        </p>
      </LegalSection>

      <LegalSection title="13. Legislação aplicável">
        <p>
          Estes Termos são interpretados de acordo com a legislação brasileira, sem prejuízo de normas administrativas,
          regulamentos internos e demais regras específicas aplicáveis ao órgão ou setor usuário.
        </p>
      </LegalSection>

      <LegalSection title="14. Contato">
        <p>
          Dúvidas sobre estes Termos ou sobre o funcionamento do EMPROVEX podem ser encaminhadas para
          <strong> aprov1hgesm@gmail.com</strong>.
        </p>
      </LegalSection>
    </PublicLegalLayout>
  );
}
