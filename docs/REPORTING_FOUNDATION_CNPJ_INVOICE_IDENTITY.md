# RELATÓRIOS — FUNDAÇÃO CNPJ E IDENTIDADE DE NF

## Escopo consolidado — Blocos 0, 1 e 2

Esta etapa prepara a evolução da aba Relatórios sem alterar ainda sua experiência principal.

### Bloco 0 — baseline e proteção

- guard permanente `verify:reporting-foundation`;
- testes unitários de normalização CNPJ/NF;
- casos obrigatórios: `01234 === 1234`, mesmo número em CNPJs diferentes e bloqueio conservador de registros legados sem CNPJ.

### Bloco 1 — CNPJ como dado operacional

- `Empenho.supplierCnpj` passa a existir como campo persistente opcional;
- cadastro manual permite informar CNPJ;
- importação JSON da NE preserva o CNPJ já extraído pela IA;
- revisão da NE valida e salva o CNPJ;
- NFs novas herdam o CNPJ do empenho.

O campo permanece opcional para compatibilidade com dados históricos. Valores informados precisam conter 14 dígitos após normalização.

### Bloco 2 — identidade segura das Notas Fiscais

O número exibido da NF continua em `Invoice.id`, porém a identidade de armazenamento passa a poder usar `Invoice.recordKey`.

Para novas NFs com CNPJ conhecido:

```
recordKey = nf_<CNPJ14>_<numeroNFNormalizado>
```

Exemplo:

```
CNPJ: 02.483.088/0001-75
NF exibida: 01234
NF normalizada: 1234
recordKey: nf_02483088000175_1234
```

Registros antigos sem `recordKey` continuam usando seu `id` histórico como chave do Firestore.

### Regra de colisão

- mesmo CNPJ + `01234` e `1234`: conflito, pois representam a mesma NF;
- CNPJs diferentes + mesmo número normalizado: permitido;
- NF legada sem CNPJ + mesmo número: bloqueio conservador até o CNPJ histórico ser conhecido.

### Não realizado nesta etapa

- nenhuma migração destrutiva dos documentos existentes;
- nenhuma importação SAG;
- nenhuma alteração automática de NS;
- nenhuma mudança nas regras de autenticação ou multi-tenant;
- nenhuma alteração da estrutura visual principal da aba Relatórios.
