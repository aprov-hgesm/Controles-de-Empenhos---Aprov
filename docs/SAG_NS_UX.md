# Bloco 13 — Refinamentos finais de UX dos Relatórios SAG

O Bloco 13 melhora a experiência de uso sem alterar contrato, reconciliação, confirmação humana, transação, locks ou Firestore Rules.

## Mudanças

- navegador compacto de progresso em quatro etapas;
- seletor de fornecedor recolhível após a escolha do CNPJ;
- resumo do favorecido preservado sem manter centenas de cards abertos;
- diagnóstico técnico CNPJ → NF → NE recolhido por padrão;
- prévia final com filtros por decisão;
- cards responsivos no mobile;
- tabela completa mantida no desktop;
- ação de confirmação fixa no rodapé do modal em telas pequenas;
- botão **Importar outro relatório** após sucesso;
- tabs de Relatórios horizontalmente roláveis no mobile.

## Hierarquia visual

A interface passa a separar três níveis:

1. **Fluxo operacional** — o que o usuário precisa fazer agora.
2. **Prévia de aplicação** — o que será alterado, mantido, ignorado ou bloqueado.
3. **Diagnóstico técnico** — detalhes determinísticos usados apenas quando há necessidade de investigação.

Isso reduz a duplicação visual sem esconder informação.

## Segurança preservada

O componente visual continua sem acesso direto ao Firestore.

A gravação ainda depende de:

- JSON válido;
- conciliação determinística;
- prévia sem bloqueios;
- confirmação humana explícita;
- fingerprint da prévia;
- revalidação pré-commit;
- transação atômica;
- lock por NS.

Nenhuma regra de persistência foi relaxada neste bloco.
