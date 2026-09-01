# TODO

## Menu mobile no cabeçalho

`CabecalhoComponent` (`cabecalho.component.scss`) não tem breakpoint próprio. Em telas
estreitas, logo + 6 links de categoria + 4 ícones de ação disputam o mesmo espaço, e o
menu de categorias vira uma tirinha que só funciona rolando horizontalmente com texto
cortado.

Solução proposta: menu hambúrguer no mobile, abrindo as categorias em um painel/drawer
(mesmo padrão já usado na gaveta do carrinho e no painel de busca).

## Acompanhamento de pedido

Hoje o cliente não tem como acompanhar o pedido depois da compra:
- `/checkout` só mostra uma tela de sucesso, sem número de pedido nem link de acompanhamento.
- `/conta` é um placeholder (nome/e-mail fixos), sem histórico de pedidos.

Isso depende de um backend real que persista pedidos (hoje é tudo mock). Quando for
implementar, duas abordagens possíveis:

1. **Área "Meus pedidos" em `/conta`** — exige login/cadastro real; mostra histórico e
   status de cada pedido. Melhor para clientes recorrentes.
2. **Link único de acompanhamento por pedido** (ex.: `/pedido/:codigo`, enviado por
   e-mail/WhatsApp) — não exige conta, mas cada pedido fica isolado, sem histórico
   consolidado.
