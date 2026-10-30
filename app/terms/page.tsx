import type { Metadata } from 'next';

import { LegalSection, PublicLegalLayout } from '../../components/legal/PublicLegalLayout';
import { CURRENT_LEGAL_BUNDLE } from '../../lib/legalVersions';

export const metadata: Metadata = {
  title: 'Termos de Serviço | EMPROVEX',
  description: 'Condições de contratação por setor, pagamentos, uso das funcionalidades e direitos sobre dados operacionais do EMPROVEX.',
};

export default function TermsPage() {
  return (
    <PublicLegalLayout
      eyebrow="Condições de utilização"
      title="Termos de Serviço"
      description="Estes Termos estabelecem as condições para utilização do EMPROVEX como serviço por usuários e workspaces previamente autorizados."
      updatedAt="29 de outubro de 2026"
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
          O EMPROVEX é uma plataforma SaaS de apoio à gestão logística e financeira dos Setores de Aprovisionamento
          de Organizações Militares, com recursos para empenhos, fornecedores, itens, notas fiscais,
          recebimento, cronogramas, relatórios, documentos, Central de Depósitos, controle de materiais
          e operação móvel, conforme as funcionalidades disponibilizadas ao setor.
        </p>
        <p>
          A oferta comercial vigente utiliza o <strong>Plano Completo</strong>. A assinatura remunera as
          funcionalidades e os serviços do EMPROVEX para o <strong>workspace/setor contratado</strong>, e não
          uma assinatura individual para cada militar. A disponibilização de recursos depende da autorização
          dos usuários, do estado da assinatura e das condições específicas de cada contrato.
          Isenções VIP e condições históricas válidas são preservadas.
        </p>
      </LegalSection>

      <LegalSection title="2.1. Natureza do apoio administrativo">
        <p>
          O EMPROVEX não é sistema oficial de execução orçamentária, financeira ou patrimonial da Administração
          Pública e não substitui SIAFI, SISCOFIS ou outros controles exigidos pela Organização Militar.
          Conferências, autorizações, assinaturas, aprovações e responsabilidades funcionais continuam a cargo
          dos agentes e órgãos competentes.
        </p>
      </LegalSection>

      <LegalSection title="3. Trial e início da utilização">
        <p>
          O EMPROVEX pode conceder um período gratuito de teste, cujo prazo padrão é de 30 dias quando
          autorizado. O prazo efetivamente concedido é informado ao setor. O trial não conta como mês pago
          na progressão de preços, não gera cobrança automática e seu encerramento não elimina dados do workspace.
        </p>
      </LegalSection>

      <LegalSection title="4. Plano progressivo e pagamento pela InfinitePay">
        <p>
          Para <strong>novas contratações elegíveis</strong> sujeitas à política progressiva vigente,
          a mensalidade do setor é de <strong>R$ 29,90 nos meses pagos 1 a 3</strong>,
          <strong>R$ 39,90 nos meses 4 a 6</strong>, <strong>R$ 49,90 nos meses 7 a 9</strong>,
          <strong>R$ 59,90 nos meses 10 a 12</strong> e <strong>R$ 69,90 a partir do mês 13</strong>.
          A contagem acompanha a primeira competência mensal paga após eventual trial; o período gratuito
          não integra os meses pagos. O cronograma integral de valores é apresentado ao responsável do setor
          <strong>antes do aceite financeiro expresso</strong>. O aceite desses preços é distinto do
          aceite geral dos Termos e não realiza pagamento. Contratos anteriores e isenções VIP
          não são reenquadrados nem reajustados retroativamente por esta política.
        </p>
        <p>
          Cada mensalidade exigível é cobrada por competência, mediante checkout externo da
          <strong>InfinitePay</strong>, com os meios de pagamento habilitados no checkout. Não existe
          débito recorrente automático pela simples assinatura dos Termos. O EMPROVEX não coleta
          diretamente o número completo nem o código de segurança de cartão. Um checkout iniciado ou
          o retorno do navegador não equivalem a quitação: a liberação financeira depende da confirmação
          efetiva da transação por verificação do servidor ou procedimento administrativo autorizado.
          Enquanto houver pagamento pendente de confirmação, não repita a mesma cobrança; consulte
          primeiro o histórico da InfinitePay e o suporte.
        </p>
        <p>
          Suspeitas de pagamento duplicado, divergência de valor, cancelamento ou pedido de reembolso
          devem ser comunicados ao suporte com a identificação da cobrança, para apuração conforme
          a transação efetiva, as condições contratadas e a legislação aplicável. Não há promessa de
          estorno automático nem de liberação imediata baseada somente em comprovante ou redirecionamento.
        </p>
      </LegalSection>

      <LegalSection title="4.1. Pagamento compartilhado e taxa de divisão">
        <p>
          Opcionalmente, o setor poderá dividir o pagamento de uma mesma competência entre
          dois ou mais participantes identificados pelo responsável pela conta. A modalidade
          não cria contas, perfis, workspaces, licenças ou assinaturas adicionais: o acesso
          ao EMPROVEX continua vinculado à mesma conta e ao mesmo setor contratado.
        </p>
        <p>
          Todas as cotas terão o mesmo valor, calculado pela divisão da mensalidade pela
          quantidade de participantes e <strong>arredondamento de cada cota para cima,
          até o próximo centavo</strong>. A eventual diferença entre a soma das cotas e
          a mensalidade original constitui uma <strong>taxa de divisão por arredondamento</strong>
          do EMPROVEX, não uma tarifa bancária ou taxa cobrada pela InfinitePay.
          O valor da taxa, o valor individual, o total a pagar e a quantidade de cotas
          serão exibidos antes do aceite e da emissão das cobranças.
        </p>
        <p>
          O rateio fica fixado para a competência e cada cota é cobrada uma única vez
          por link próprio. Os links podem ser encaminhados aos integrantes sem compartilhar
          credenciais de acesso. Qualquer integrante poderá assumir voluntariamente uma
          cota ainda pendente. O setor é responsável pela quitação de todas as cotas;
          pagamentos parciais não constituem quitação integral da mensalidade.
          Continuam aplicáveis as regras de vencimento e tolerância do contrato,
          sem bloqueio antecipado exclusivamente pela opção de rateio.
        </p>
      </LegalSection>

      <LegalSection title="4.2. Início do período pago, aniversário e renovação">
        <p>
          Nos novos contratos sujeitos à modalidade de <strong>aniversário mensal por pagamento
          confirmado</strong>, o primeiro período pago começa na data e hora em que o
          EMPROVEX confirmar a primeira mensalidade integral. No pagamento compartilhado,
          a ativação começa apenas depois de verificada a última cota. O período coberto
          corresponde a <strong>um mês de calendário</strong>, não necessariamente a
          trinta dias exatos.
        </p>
        <p>
          As renovações seguintes ocorrem a cada mês na data de aniversário fixada na
          primeira quitação. Em meses sem o mesmo dia, o aniversário ocorre no último
          dia do mês correspondente. A cobrança de renovação não muda o aniversário
          caso o cliente pague durante o prazo de tolerância.
        </p>
        <p>
          Para as renovações de períodos anteriormente quitados, aplica-se
          <strong>tolerância de dez dias corridos após o aniversário</strong> para
          regularizar a nova competência. Essa tolerância não constitui um mês
          gratuito adicional e não se aplica à primeira ativação paga. Após seu
          encerramento sem quitação, as funcionalidades operacionais sujeitas ao
          controle financeiro poderão ser restringidas; os dados permanecem
          preservados conforme estes Termos.
        </p>
        <p>
          Quando uma primeira mensalidade for quitada depois da data inicialmente
          estimada no cadastro, o aniversário será fixado pela confirmação real do
          pagamento, sem perda dos dias anteriores à ativação. Contratos preexistentes
          mantêm suas datas e condições anteriores, sem reancoragem retroativa.
          A plataforma informará em Minha Assinatura as datas de uso, renovação
          e eventual tolerância aplicáveis.
        </p>
      </LegalSection>

      <LegalSection title="5. Contas, credenciais e acesso">
        <p>
          A Organização Militar é a entidade institucional a que o setor está vinculado; o
          <strong>workspace</strong> é o ambiente lógico de dados e funcionalidades do setor; a
          <strong>conta contratante</strong> representa a contratação e suas obrigações financeiras;
          e o <strong>usuário autorizado</strong> é a pessoa credenciada a atuar no ambiente, segundo
          o perfil e o vínculo institucional aplicáveis. Esses conceitos não são intercambiáveis.
          Cada usuário deve proteger suas credenciais e não compartilhar senhas ou tokens.
        </p>
        <p>
          Cada usuário deve atuar somente no workspace e na Unidade Gestora a que estiver autorizado.
          É proibido utilizar credenciais alheias, explorar falhas de autorização, alterar registros sem
          permissão ou consultar dados de outro setor. Direitos sobre dados próprios não afastam
          autenticação, sigilo, integridade ou segregação entre organizações.
        </p>
      </LegalSection>

      <LegalSection title="6. Suspensão e reativação">
        <p>
          O controle financeiro vigente pode restringir <strong>as funcionalidades operacionais</strong>
          por mensalidade vencida e não regularizada, observadas as regras de vencimento e eventual tolerância
          aplicáveis ao contrato. Essa medida é distinta de restrições motivadas por segurança, fraude,
          uso indevido ou exigência institucional. A inadimplência, por si só, não transfere ao EMPROVEX
          os dados cadastrados nem autoriza seu bloqueio coercitivo para impedir recuperação legítima.
        </p>
        <p>
          Após a regularização e a <strong>confirmação adequada</strong> do pagamento, as funções
          contratadas poderão ser reativadas, respeitadas outras restrições de segurança ou autorização
          eventualmente incidentes. O histórico operacional preservado não precisa ser recadastrado
          apenas pela regularização comercial.
        </p>
      </LegalSection>

      <LegalSection title="6.1. Solicitação de 48 horas">
        <p>
          Conforme a política em vigor e a elegibilidade da competência, o setor poderá solicitar
          uma liberação extraordinária temporária de até <strong>48 horas</strong>, limitada pelas
          regras operacionais do portal. A concessão não constitui quitação, não se renova automaticamente
          e não afasta a necessidade de regularização. Solicitar não significa obter aprovação irrestrita.
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

      <LegalSection title="7.1. Direitos sobre dados e recuperação legítima">
        <p>
          <strong>A assinatura remunera o software e os serviços, não a propriedade dos dados operacionais
          cadastrados pelo setor.</strong> O armazenamento no EMPROVEX não converte informações
          institucionais em ativos comerciais do fornecedor. A titularidade, a guarda e a destinação
          de registros institucionais observam a legislação e as normas da Organização Militar;
          dados pessoais também preservam os direitos de seus respectivos titulares.
        </p>
        <p>
          O encerramento ou a suspensão financeira não autorizam reter dados do próprio setor
          como meio de pressionar pelo pagamento. O responsável legitimamente autorizado poderá
          solicitar a disponibilização das informações operacionais pertinentes <strong>sem cobrança
          adicional apenas pelo fornecimento dos dados</strong>, observadas identificação,
          autorização institucional, sigilo e privacidade. O formato e a forma de entrega serão
          acordados segundo as capacidades técnicas disponíveis e a segurança necessária;
          não se promete ferramenta automática de exportação.
        </p>
        <p>
          Essa recuperação não concede acesso a dados de outros workspaces, direito de alterar
          registros sem permissão nem licença sobre o código do EMPROVEX. Documentos públicos
          e registros administrativos podem estar sujeitos a obrigações próprias de conservação.
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
          quando autorizadas pelo usuário, integrações Google Drive e Gmail, além do checkout da
          InfinitePay. O Pix e o cartão são meios de pagamento do provedor, não provedores contratados
          pelo EMPROVEX. Cada serviço de terceiro possui termos e políticas próprios.
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
          O tratamento de dados pessoais, informações operacionais institucionais e registros técnicos
          de segurança é descrito na <a href="/privacy" className="font-bold text-[#00288e] underline">Política
          de Privacidade</a>. A solicitação de dados institucionais por responsável autorizado
          não se confunde com o exercício individual dos direitos previstos na LGPD.
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
