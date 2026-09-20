# Bloco 17.8 — Regressão e consumo

O baseline 17.0 permanece imutável. Este bloco registra o estado pós-otimização sem confundir estimativa de aplicação com cobrança oficial.

## Cenários protegidos

- heartbeat de lease de 30 minutos / renovação nominal de 15 minutos;
- sessão lógica compartilhada entre múltiplas abas do mesmo navegador;
- controle de lifecycle e revogação autônomo em cada aba, sem líder/seguidora;
- mutex curto somente quando uma renovação de heartbeat está vencida;
- fechar uma aba sem interromper as demais;
- revogação observada diretamente em todas as abas;
- limite de duas sessões externas e terceira sessão recusada;
- Home com snapshot econômico;
- navegação entre abas com subscriptions mínimas;
- Relatórios sem listener global de NFs;
- NFs históricas consultadas por empenho/CNPJ com paginação;
- Drive e branding sem listeners permanentes;
- múltiplas UGs continuam isoladas;
- E2E com Firebase Emulator permanece sem App Check de produção.

## Trade-off deliberado

O Bloco 17.2 não tenta mais reduzir os três listeners de controle para um único conjunto por navegador. Cada aba mantém seus próprios três listeners. Essa duplicação é aceita porque remove eleição persistente, failover de papéis e BroadcastChannel do caminho crítico.

A principal economia periódica continua preservada pelo 17.1: renovação normal com 0 reads explícitas + 1 write a cada 15 minutos. O timestamp compartilhado e o mutex curto evitam writes duplicados entre abas quando Web Locks está disponível.

A otimização não acrescenta confirmação, formulário ou refresh manual ao fluxo normal do operador.
