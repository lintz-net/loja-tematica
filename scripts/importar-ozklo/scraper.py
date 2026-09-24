"""
Raspa o catálogo da OZKLO (fornecedor autorizado): baixa as imagens de cada produto (como o
download_imagens.py original já fazia) e extrai nome, descrição, categoria, preço e variantes
(cor/tamanho/estoque/SKU reais) de cada um.

A OZKLO roda em cima da Tiendanube/Nuvemshop. Duas fontes de dado foram tentadas antes desta
versão e descartadas: (1) os blocos JSON-LD `Product` da página — a página embute vários (o
carrossel de "produtos relacionados" também tem o seu), pegar "o primeiro" pegava o produto
errado na prática; (2) sem separar cor/tamanho de verdade. A fonte confiável usada aqui é
`window.LS` — o estado do próprio tema da loja, sempre do produto certo da página:
  - `window.LS.product` — nome real do produto.
  - `window.LS.variants` — uma entrada por combinação cor/tamanho, com sku, estoque, preço,
    preço "de" (compare_at) e foto específica daquela variante.
A descrição vem do maior bloco `.user-content` do DOM (a página tem mais de um — o menor é o
aviso fixo de "meça-se antes de comprar", presente em todo produto; o maior é a descrição em
si). O breadcrumb (pra sugerir categoria) vem do único bloco JSON-LD `@type: WebPage`, que
não sofre da ambiguidade dos blocos `Product`.

Não grava nada no Supabase. Só gera:
  - imagens_produtos_ozklo/<n>_<slug>/foto_XX.jpg — igual antes.
  - catalogo.json — um array com os dados extraídos de cada produto, pra revisar à mão antes
    de importar (ver importar.py).

Rodar:
    pip install playwright requests
    playwright install chromium
    python scraper.py
"""

import json
import os
import re
import traceback
import requests
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.ozklo.com.br/produtos/"
OUTPUT_FOLDER = "imagens_produtos_ozklo"
CATALOGO_JSON = "catalogo.json"

# Tokens de tamanho comuns em moda BR — usados só pra decidir qual das opções (option0/
# option1) de uma variante é "tamanho" e qual é "cor", quando a ordem não for a usual.
TOKENS_TAMANHO = {
    "pp", "p", "m", "g", "gg", "xg", "eg", "egg", "xgg", "u", "unico", "único",
    "36", "38", "40", "42", "44", "46", "48", "50", "52", "54",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def normalizar_url(href):
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://www.ozklo.com.br" + href
    return href


def normalizar_sem_protocolo(url):
    """Tira o esquema (https:/http:/nenhum, no caso de urls protocol-relative //cdn/...) pra
    comparar a mesma imagem venha ela da galeria (sempre https:) ou de window.LS.variants
    (vem como //cdn/..., sem protocolo)."""
    return re.sub(r"^https?:", "", url)


def sanitizar_nome_pasta(nome):
    nome_limpo = re.sub(r'[\\/*?:"<>|]', "", nome)
    return nome_limpo.strip().replace(" ", "_")


def gerar_slug(nome):
    slug = nome.strip().lower()
    slug = re.sub(r"[àáâãäå]", "a", slug)
    slug = re.sub(r"[èéêë]", "e", slug)
    slug = re.sub(r"[ìíîï]", "i", slug)
    slug = re.sub(r"[òóôõö]", "o", slug)
    slug = re.sub(r"[ùúûü]", "u", slug)
    slug = slug.replace("ç", "c")
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug


def coletar_urls_galeria(page):
    """As imagens em alta-res do carrossel principal ficam no href de
    <a data-fancybox="product-gallery" href="...">, então basta ler esse atributo direto."""
    links = page.query_selector_all("a.js-product-slide-link[data-fancybox='product-gallery']")
    urls = []
    vistos = set()
    for a in links:
        href = a.get_attribute("href")
        if not href:
            continue
        href = normalizar_url(href)
        if href not in vistos:
            vistos.add(href)
            urls.append(href)
    return urls


def extrair_estado_loja(page):
    """window.LS é o estado do tema Tiendanube pra esta página — sempre o produto certo,
    ao contrário dos blocos JSON-LD (que incluem produtos do carrossel de recomendados)."""
    dados = page.evaluate("""
        () => {
            try {
                return {
                    product: window.LS && window.LS.product ? window.LS.product : null,
                    variants: window.LS && window.LS.variants ? window.LS.variants : null,
                };
            } catch (e) {
                return { product: null, variants: null };
            }
        }
    """)
    return dados.get("product"), dados.get("variants")


def extrair_breadcrumb_ld(page):
    """Único bloco JSON-LD @type=WebPage da página (ao contrário de @type=Product, que se
    repete pros itens do carrossel de recomendados) — carrega o breadcrumb real."""
    for script in page.query_selector_all("script[type='application/ld+json']"):
        texto = script.inner_text()
        if not texto or not texto.strip():
            continue
        try:
            dados = json.loads(texto)
        except json.JSONDecodeError:
            continue
        if isinstance(dados, dict) and dados.get("@type") == "WebPage":
            breadcrumb = dados.get("breadcrumb")
            if isinstance(breadcrumb, dict):
                return breadcrumb
    return None


def extrair_categorias_breadcrumb(breadcrumb_ld):
    """Nomes das categorias do breadcrumb (excluindo 'Início' e o próprio produto, que é
    sempre o último item) — só pra te ajudar a decidir manualmente pra qual categoria da sua
    loja cada produto deve ir. Não é gravado direto como categoria nossa."""
    if not breadcrumb_ld:
        return []
    itens = breadcrumb_ld.get("itemListElement", [])
    nomes = []
    for item in itens[:-1]:  # último item = o próprio produto
        nome = item.get("name")
        if nome and nome.strip().lower() not in ("início", "home", "inicio"):
            nomes.append(nome.strip())
    return nomes


def extrair_descricao(page):
    """A página tem mais de um bloco `.user-content`: o(s) menor(es) são avisos fixos (guia
    de medidas etc.), o maior é a descrição de verdade do produto — pega sempre o maior."""
    blocos = page.query_selector_all(".user-content")
    melhor = ""
    for bloco in blocos:
        texto = bloco.inner_text().strip()
        if len(texto) > len(melhor):
            melhor = texto
    return melhor


def eh_token_tamanho(valor):
    if not valor:
        return False
    return valor.strip().lower() in TOKENS_TAMANHO


def montar_variantes(produto_id, variantes_ls):
    """Cada entrada de window.LS.variants já é uma combinação cor/tamanho real, com sku,
    estoque e preço próprios — nada de adivinhar aqui. option0/option1 normalmente são
    cor/tamanho nessa ordem, mas se algum bater num token de tamanho conhecido na posição
    "errada", inverte (evita cor='M' quando na real é o contrário nalgum produto)."""
    variantes = []
    for i, v in enumerate(variantes_ls or [], start=1):
        opcoes = [o for o in (v.get("option0"), v.get("option1"), v.get("option2")) if o]

        if len(opcoes) >= 2:
            if eh_token_tamanho(opcoes[0]) and not eh_token_tamanho(opcoes[1]):
                tamanho, cor = opcoes[0], opcoes[1]
            else:
                cor, tamanho = opcoes[0], opcoes[1]
        elif len(opcoes) == 1:
            cor, tamanho = ("Único", opcoes[0]) if eh_token_tamanho(opcoes[0]) else (opcoes[0], "Único")
        else:
            cor, tamanho = "Único", "Único"

        variantes.append({
            "id": f"{produto_id}-v{i}",
            "produtoId": produto_id,
            "sku": v.get("sku") or f"{produto_id}-v{i}",
            "tamanho": tamanho,
            "cor": cor,
            "quantidadeEstoque": v.get("stock") if v.get("available") else 0,
            "precoOverride": v.get("price_number"),
        })
    return variantes


def montar_imagens_por_cor(variantes, variantes_ls, mapa_url_arquivo):
    """`window.LS.variants[i].image_url` é a mesma imagem que já baixamos da galeria — só
    precisa achar qual arquivo local corresponde (por url normalizada) e agrupar por cor,
    preservando a ordem de primeira aparição. Cor sem nenhuma imagem própria identificada
    fica de fora do dict (a galeria inteira continua valendo como fallback pra ela)."""
    imagens_por_cor = {}
    for variante, bruta in zip(variantes, variantes_ls):
        image_url = bruta.get("image_url")
        if not image_url:
            continue
        arquivo = mapa_url_arquivo.get(normalizar_sem_protocolo(image_url))
        if not arquivo:
            continue
        cor = variante["cor"]
        lista = imagens_por_cor.setdefault(cor, [])
        if arquivo not in lista:
            lista.append(arquivo)
    return imagens_por_cor


def calcular_precos(variantes_ls):
    """preco_base = maior preço "de" (compare_at) entre as variantes, ou o maior preço "por"
    se nenhuma tiver desconto. preco_promocional = menor preço "por" entre as que têm
    desconto, só se for de fato menor que o preco_base (regra do nosso schema)."""
    if not variantes_ls:
        return None, None

    precos_de = [v.get("compare_at_price_number") or v.get("price_number") for v in variantes_ls]
    preco_base = max(p for p in precos_de if p is not None) if precos_de else None

    precos_promocionais = [
        v["price_number"] for v in variantes_ls
        if v.get("has_promotional_price") and v.get("price_number") is not None
    ]
    preco_promocional = min(precos_promocionais) if precos_promocionais else None
    if preco_promocional is not None and preco_base is not None and preco_promocional >= preco_base:
        preco_promocional = None

    return preco_base, preco_promocional


def extrair_produto(page, url_produto, index_produto, sessao_http):
    print(f"\n[+] Acessando produto #{index_produto}: {url_produto}")

    try:
        page.goto(url_produto, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        print(f"   [ERRO] Falha ao carregar a página: {e}")
        return None

    page.wait_for_timeout(1500)

    # Capturado agora, antes de qualquer clique abaixo — clicar num "swatch" de cor às vezes
    # acerta sem querer um link de verdade (categoria, breadcrumb) e navega a página, o que
    # faria page.url no fim da função apontar pra outro lugar (já aconteceu: virava a home).
    url_final = page.url

    produto_ls, variantes_ls = extrair_estado_loja(page)
    breadcrumb_ld = extrair_breadcrumb_ld(page)

    titulo_tag = page.query_selector("h1")
    nome_produto = (
        (produto_ls or {}).get("name")
        or (titulo_tag.inner_text().strip() if titulo_tag else None)
        or f"produto_{index_produto}"
    )
    nome_produto = nome_produto.strip()

    descricao = extrair_descricao(page)

    urls = coletar_urls_galeria(page)

    # tenta clicar nas variantes de cor e recoleta -- em alguns temas a galeria muda por cor
    try:
        seletores_variante = page.query_selector_all(
            "[class*='color'] li, [class*='swatch'], .item-variant, "
            "ul[class*='variant'] li, .attribute-values li"
        )
        for el in seletores_variante[:15]:
            try:
                if el.is_visible():
                    el.click(timeout=1500)
                    page.wait_for_timeout(500)
                    for u in coletar_urls_galeria(page):
                        if u not in urls:
                            urls.append(u)
            except Exception:
                continue
    except Exception as e:
        print(f"   [DEBUG] Falha ao clicar variantes: {e}")

    if not urls:
        print("   [!] Nenhuma imagem de galeria encontrada (verifique se o seletor mudou).")

    if not variantes_ls:
        print("   [!] Sem window.LS.variants — produto sem variação nesta loja? Confira à mão.")

    slug = gerar_slug(nome_produto)
    produto_id = f"ozklo-{slug}"

    variantes = montar_variantes(produto_id, variantes_ls)
    preco_base, preco_promocional = calcular_precos(variantes_ls)

    categorias_sugeridas = extrair_categorias_breadcrumb(breadcrumb_ld)

    pasta_produto = os.path.join(OUTPUT_FOLDER, f"{index_produto:03d}_{sanitizar_nome_pasta(nome_produto)}")
    os.makedirs(pasta_produto, exist_ok=True)

    arquivos_baixados = []
    mapa_url_arquivo = {}  # url da galeria (sem protocolo) -> nome do arquivo local salvo
    for i, url in enumerate(urls, start=1):
        try:
            resp = sessao_http.get(url, timeout=20)
            resp.raise_for_status()
            ext = os.path.splitext(url.split("?")[0])[1] or ".jpg"
            filename = f"foto_{i:02d}{ext}"
            filepath = os.path.join(pasta_produto, filename)
            with open(filepath, "wb") as f:
                f.write(resp.content)
            arquivos_baixados.append(filepath)
            mapa_url_arquivo[normalizar_sem_protocolo(url)] = filename
            print(f"   [OK] Salvo ({len(resp.content) // 1024} KB): {filename}  <-  {url}")
        except Exception as e:
            print(f"   [ERRO] Falha ao baixar {url}: {e}")

    imagens_por_cor_arquivos = montar_imagens_por_cor(variantes, variantes_ls or [], mapa_url_arquivo)

    print(f"   [DEBUG] nome={nome_produto!r} preco_base={preco_base} preco_promocional={preco_promocional} "
          f"variantes={len(variantes)} categorias_sugeridas={categorias_sugeridas} "
          f"cores_com_foto_propria={list(imagens_por_cor_arquivos.keys())}")

    return {
        "id": produto_id,
        "nome": nome_produto,
        "slug": slug,
        "descricao": descricao,
        "precoBase": preco_base,
        "precoPromocional": preco_promocional,
        "categoriasSugeridas": categorias_sugeridas,
        "urlOrigem": url_final,  # url após redirect de goto, mas antes dos cliques de variante
        "pastaImagensLocais": pasta_produto,
        "arquivosImagens": [os.path.basename(a) for a in arquivos_baixados],
        "imagensPorCorArquivos": imagens_por_cor_arquivos,  # cor -> [nomes de arquivo locais]
        "variantes": variantes,
    }


def coletar_links_produtos(page, url_catalogo):
    page.goto(url_catalogo, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2000)

    links_elementos = page.query_selector_all("a[href*='/produtos/']")
    links_produtos = set()

    for a in links_elementos:
        href = a.get_attribute("href") or ""
        if "/produtos/" not in href:
            continue
        if not href.startswith("http"):
            href = "https://www.ozklo.com.br" + href
        href_limpo = href.split("?")[0].rstrip("/")
        if href_limpo == "https://www.ozklo.com.br/produtos":
            continue
        resto = href_limpo.split("/produtos/")[-1]
        if "/" in resto:
            continue
        links_produtos.add(href_limpo)

    return links_produtos


def rodar_scraper():
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    sessao_http = requests.Session()
    sessao_http.headers.update(HEADERS)

    catalogo = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        pagina_catalogo = 1
        contador_produtos = 1
        produtos_visitados = set()

        try:
            while True:
                url_catalogo = f"{BASE_URL}?page={pagina_catalogo}"
                print(f"\n{'=' * 60}")
                print(f"Lendo Catálogo Página {pagina_catalogo}: {url_catalogo}")
                print(f"{'=' * 60}")

                try:
                    links_produtos = coletar_links_produtos(page, url_catalogo)
                except Exception as e:
                    print(f"[ERRO] Falha ao carregar catálogo página {pagina_catalogo}: {e}")
                    break

                links_novos = sorted(links_produtos - produtos_visitados)
                print(f"   -> {len(links_produtos)} links de produto encontrados nesta página ({len(links_novos)} novos)")

                if not links_novos:
                    print("Nenhum novo produto encontrado. Finalizando script!")
                    break

                for url_prod in links_novos:
                    produtos_visitados.add(url_prod)
                    try:
                        produto = extrair_produto(page, url_prod, contador_produtos, sessao_http)
                        if produto:
                            catalogo.append(produto)
                    except Exception:
                        print(f"   [ERRO] Falha inesperada no produto {url_prod}:")
                        traceback.print_exc()
                    contador_produtos += 1

                pagina_catalogo += 1
        finally:
            try:
                browser.close()
            except Exception:
                pass

    with open(CATALOGO_JSON, "w", encoding="utf-8") as f:
        json.dump(catalogo, f, ensure_ascii=False, indent=2)

    print(f"\n{len(catalogo)} produtos gravados em {CATALOGO_JSON}.")
    print("Revise o arquivo (principalmente precoBase=null e categoriasSugeridas vazio) antes "
          "de rodar importar.py.")


if __name__ == "__main__":
    rodar_scraper()
