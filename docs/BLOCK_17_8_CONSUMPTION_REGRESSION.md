# Bloco 17.8 — Regressão e consumo

O baseline 17.0 permanece imutável. Este bloco registra o estado pós-otimização sem confundir estimativa de aplicação com cobrança oficial.

## Cenários protegidos

- heartbeat de lease de 30 minutos / renovação nominal de 15 minutos;
- múltiplas abas com exatamente uma coordenadora quando Web Locks + BroadcastChannel estão disponíveis;
- failover preservando o mesmo sessionId;
- revogação em todas as abas;
- limite de duas sessões externas e terceira sessão recusada;
- Home com snapshot econômico;
- navegação entre abas com subscriptions mínimas;
- Relatórios sem listener global de NFs;
- NFs históricas consultadas por empenho/CNPJ com paginação;
- Drive e branding sem listeners permanentes;
- múltiplas UGs continuam isoladas;
- E2E com Firebase Emulator permanece sem App Check de produção.

A otimização não acrescenta confirmação, formulário ou refresh manual ao fluxo normal do operador.
