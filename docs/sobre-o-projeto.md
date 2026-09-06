# Sobre o projeto — Loja Temática (Vista Nostálgica)

## Propósito

Vitrine e-commerce para o usuário atuar como **revendedor autorizado da Ozklo**, marca que vende camisetas, bermudas e polos com estampas de cultura pop (games, cinema, cartoons, bandas, carros clássicos, humor). O projeto nasceu como protótipo/mock funcional — hoje já reflete o catálogo real da Ozklo (128 produtos com fotos reais do fornecedor) — e serve de base para uma loja própria, independente da vitrine oficial da marca.

## Público-alvo

- Pessoas de ~18–40 anos com interesse em cultura pop/geek, nostalgia (desenhos retrô, games clássicos) e streetwear casual.
- Compradores mobile-first: a navegação (hover na listagem, swipe na galeria) foi pensada para funcionar bem tanto em desktop quanto em touch.
- Público disposto a comprar por afinidade temática (torcedor, fã de banda, fã de determinado desenho/jogo) mais do que por marca de moda tradicional.

## O que a loja vende

Peças estampadas organizadas em 6 categorias temáticas, cada uma com identidade visual própria (cor e fonte de destaque):

| Categoria | Exemplos de produto |
|---|---|
| 🎸 Música | bandas (ACDC, Ramones, Gorillaz), itens fictícios de turnê |
| ⚽ Futebol | camisas/cachecóis de times fictícios |
| 🕹️ Geek | games, animes, super-heróis, ficção científica (maior categoria, ~64 produtos) |
| 🏁 Automotivo | Fusca, Kombi, Opala, Mustang, GTR, moto |
| 🎬 Cinema | Top Gun, Harry Potter, Transformers, Máscara |
| 😂 Humor | Simpsons, Snoopy, Pica-Pau, South Park, cartoons clássicos |

Tipos de peça: camiseta (maioria, ~R$45), bermuda (~R$69,90), polo (~R$59,90). Tamanhos P–GG, com variação de cor por produto.

## Estado atual do site

**Stack**: Angular 19 (standalone components, signals), sem framework CSS externo — tema visual próprio por categoria (`src/app/temas/temas.scss`).

**Funcionando:**
- **Home** (`/`) — grade de categorias.
- **Listagem por categoria** (`/categoria/:slug`) — grid de produtos com busca por nome; hover troca a foto principal pela foto do modelo vestindo (desktop only, sem esse efeito em touch).
- **Detalhe do produto** (`/produto/:slug`) — galeria com miniaturas + imagem principal centralizada (`object-fit: contain`), navegação por seta/swipe, seleção de cor (swatches) e tamanho (com indisponibilidade por estoque), guia de medidas em modal, seleção de cor pula a imagem principal para a foto daquela cor **quando o produto tem esse mapeamento** (hoje só a Camiseta Donkey Kong tem esse de-para completo; os outros 127 produtos ainda mostram a galeria completa sem esse "pulo").
- **Carrinho** (`/carrinho`) e **checkout simulado** (`/checkout`) — fluxo completo de pedido, mas **sem pagamento real** ("Pedido simulado com sucesso" ao final).
- **Conta** (`/conta`) — só exibe um usuário mockado, **sem autenticação real**.

**Arquitetura de dados** (o ponto mais importante pra evolução futura):
- Todo acesso a catálogo passa por uma interface (`CatalogoRepositorio`), com duas implementações: `CatalogoMockService` (dados em memória, hoje ativo) e `CatalogoApiService` (`HttpClient`, pronto pra apontar pra uma API real).
- A troca entre mock e API real é **uma linha** em `src/environments/environment.ts` (`useMock: true/false`) — nenhum componente precisa mudar quando o backend existir.
- Os 128 produtos e suas fotos reais (baixadas do fornecedor) vivem em `public/imagens/produtos/<slug>/` + `catalogo.mock-data.ts` / `catalogo-ozklo.manifest.ts`.

**O que ainda não existe:**
- Backend/API real (é só o cliente HTTP, sem servidor).
- Autenticação de usuário.
- Pagamento real (Pix/cartão/boleto são só botões de seleção visual).
- Mapa cor→foto para 127 dos 128 produtos (só o Donkey Kong tem esse detalhe hoje).
- Busca/filtro global (só existe busca por nome dentro de uma categoria já selecionada).

## Referências visuais

Não seguimos nenhuma loja específica como modelo — os padrões usados são convenções consolidadas de e-commerce de moda (comuns em lojas Shopify/DTC de nicho: streetwear, bandas, geek):

- **Grid de produtos com hover trocando pra foto "vestindo"** — padrão praticamente universal em lojas de roupa (SSense, ASOS, Amazon Fashion, a maioria das lojas Shopify de streetwear).
- **Galeria com miniaturas verticais + imagem grande centralizada** — padrão de páginas de produto de moda (Zara, Amazon, Shopify).
- **Swatches de cor circulares com estado selecionado** — convenção quase universal em seleção de variante de cor.
- **Tema por categoria** (cor/fonte mudando por seção) é uma decisão própria do projeto, não copiada de nenhuma referência — reforça a identidade "temática" da loja.

Se quiser, posso levantar 2–3 lojas reais nesse nicho (streetwear geek/pop culture) pra servir de benchmark mais concreto de layout, mas isso exigiria pesquisa na web — não fiz isso agora, só descrevi os padrões que já usamos.
