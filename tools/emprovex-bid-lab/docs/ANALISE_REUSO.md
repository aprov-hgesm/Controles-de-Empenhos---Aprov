# Seleção da base — 06/11/2026

Escopo: leitura de código/licenças dos candidatos, sem execução de software de terceiros e sem contato com contas de portais.

| Candidato | Evidência examinada | Decisão |
|---|---|---|
| RodrigoRMarinho/LanceBot | `src/portals/comprasnet.py` blob fae4915319db4cc4e10c1f3ee1b5b0a9139b6ffc simula login/busca; `src/core/bidding.py` blob dd3b02718289077895c98ee686b5f44dc2cb9e98 ignora piso no caminho temporizado e tem interfaces de estratégias incompatíveis; LICENSE blob 91b62615de49c6ad16984d70ac22dea0b0507466 contém texto truncado | Não incorporar código; aproveitar apenas a separação conceitual estratégia/adaptador |
| VincenzoImp/ebay-sniper-bot | `bidder.ipynb` blob df3626af186be787878aa3a61529224db41ed93b: login manual, seletor #confirmBid, busy loop por hora local, clique único sem confirmação; LICENSE blob 1b7507250fe7c8e9ff7a89ba0f9b90b74bb4c9aa MIT completo | Melhor exemplo dos candidatos para estudar interação no navegador, mas não base de produção. Reaproveitamento conceitual de sessão manual, sem portar notebook/loop |
| cyberfox/jbidwatcher | README descreve aplicação eBay; metadados identificam licença Other/NOASSERTION, não há LICENSE na raiz consultada | Não incorporar; esta consulta não conclui que não exista licença em outros arquivos |

Fontes:
- https://github.com/RodrigoRMarinho/LanceBot
- https://github.com/VincenzoImp/ebay-sniper-bot
- https://github.com/cyberfox/jbidwatcher

## Decisão técnica

Implementação original em módulos JavaScript, Manifest V3 e Node padrão. Compatível conceitualmente com a futura integração ao EMPROVEX, sem carregar um serviço Python/notebook apenas para clicar. Nenhum trecho, dependência ou asset desses três projetos foi incorporado. Portanto, não se declara o produto um fork nem se aplica automaticamente a licença deles ao código original.

O melhor reaproveitamento neste momento é arquitetural: adaptadores isolados e sessão aberta pelo operador. O problema central não é calcular `melhor preço - passo`; é comprovar identidade, regra, observação atual e aceitação, sem reenviar após timeout. A base implementada torna essas decisões testáveis antes de conectar qualquer portal.

A autorização desta etapa cobre desenvolvimento paralelo e testes locais. Não houve envio real, manipulação de contas, merge, deploy nem integração em Empresas. Branch de laboratório derivada de main, com alterações exclusivamente nesta pasta; memorial Empresas preservado.
