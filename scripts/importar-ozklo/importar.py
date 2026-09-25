"""
Segunda etapa: lê catalogo.json (gerado por scraper.py) e sincroniza com o Supabase em duas
camadas:

  1. staging_produtos_ozklo — upsert por `url_origem` (chave estável entre reraspagens, ao
     contrário do nome do produto). Guarda sempre o dado bruto mais recente da OZKLO.
  2. produtos — pra cada linha de staging:
       - sem `produto_id` vinculado ainda -> CRIA o produto (insert), sobe as imagens, e liga
         a staging a ele.
       - já vinculada (por uma importação anterior, ou manualmente pelo admin via SQL, ver
         migration-023) -> ATUALIZA só o que mudou (preço, estoque/sku das variantes, imagens
         novas) — nunca sobrescreve nome/descrição/categoria/slug, que podem ter sido
         editados a mão no admin depois da importação.
  3. Produto vinculado que sumiu do catálogo da OZKLO nesta rodada (scraper.py sempre varre
     tudo, então "não apareceu" = "não existe mais lá") -> marcado como ESGOTADO (estoque de
     toda variante zerado), nunca apagado — reversível, mantém histórico/avaliações.

Rodar em --dry-run por padrão (mostra o que faria, não grava nada — nem na staging). Só grava
de verdade com --confirmar.

Antes da primeira vez: rode docs/supabase/migration-023-staging-produtos-ozklo.sql.

Pra marcar manualmente que um produto raspado é o MESMO que um produto já existente na loja
(evitar duplicata semântica — nomes diferentes pro mesmo produto físico), rode no SQL Editor
depois do primeiro dry-run (usando a url_origem que aparece no catalogo.json):

    update staging_produtos_ozklo set produto_id = 'prod-16'
    where url_origem = 'https://www.ozklo.com.br/produtos/camiseta-coyote';

Rodar:
    pip install requests
    ADMIN_EMAIL=seu@email.com ADMIN_SENHA=suasenha python importar.py            # dry-run
    ADMIN_EMAIL=seu@email.com ADMIN_SENHA=suasenha python importar.py --confirmar
"""

import argparse
import json
import mimetypes
import os
import sys

import requests

SUPABASE_URL = "https://tmrtyotlvrznavjorkay.supabase.co"
SUPABASE_KEY = "sb_publishable_C-19JMHS11IjYHJ4ngIFQw_wfojX8DA"
BUCKET = "produtos"
CATALOGO_JSON = "catalogo.json"

# Preencha com o mapeamento "categoria da OZKLO" -> "slug da sua categoria". Chaves batem com
# o texto solto em categoriasSugeridas no catalogo.json (confira lá antes de preencher aqui).
#
# A OZKLO categoriza por corte/tipo de peça (Unisex/Feminina/Polos/Básicas/Bermudas/Plus
# Size), a loja categoriza majoritariamente por tema (Música/Futebol/Geek/Automotivo/Cinema/
# Humor/Personagens) — eixos diferentes, não dá pra mapear tudo automaticamente. "Bermuda" e
# "Camiseta" (criadas depois, 2026-09-24) são exceção: são tipo de peça mesmo, sem tema, mas
# viraram categoria própria assim mesmo por decisão do usuário. "Polos"/"Plus Size"/"Unisex"/
# "Feminina" continuam sem mapeamento de propósito.
#
# Rode antes: docs/supabase/migration-022-categoria-personagens.sql (cria a categoria
# "Personagens" — ainda não existia antes desta importação).
MAPA_CATEGORIAS = {
    "Geek": "geek",
    "Automotivos": "automotivo",
    "Bandas": "musica",
    "Personagens": "personagens",
    "Bermudas": "bermuda",
    "Básicas": "camiseta",
}


def login(email, senha):
    resposta = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": senha},
        timeout=20,
    )
    resposta.raise_for_status()
    return resposta.json()["access_token"]


def enviar_imagem(headers_auth, caminho_local, caminho_storage):
    content_type = mimetypes.guess_type(caminho_local)[0] or "application/octet-stream"
    with open(caminho_local, "rb") as f:
        conteudo = f.read()

    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{caminho_storage}",
        headers={**headers_auth, "Content-Type": content_type, "x-upsert": "true"},
        data=conteudo,
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f"Falha ao subir {caminho_storage}: {resp.status_code} {resp.text}")

    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{caminho_storage}"


def mapear_categorias(sugeridas):
    slugs = []
    nao_mapeadas = []
    for nome in sugeridas:
        slug = MAPA_CATEGORIAS.get(nome)
        if slug and slug not in slugs:
            slugs.append(slug)
        elif not slug:
            nao_mapeadas.append(nome)
    return slugs, nao_mapeadas


def upsert_staging(headers_auth, produto, dry_run):
    """Garante uma linha em staging_produtos_ozklo pra este produto (por url_origem) com o
    dado bruto mais atual, e devolve ela (com produto_id/status já existentes, se houver —
    é isso que diferencia "criar" de "atualizar" mais abaixo). Em dry-run não escreve nada,
    só consulta o que já existe (se existir) pra simular a decisão corretamente."""
    url_origem = produto["urlOrigem"]

    if dry_run:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/staging_produtos_ozklo",
            headers=headers_auth,
            params={"url_origem": f"eq.{url_origem}", "select": "*"},
            timeout=20,
        )
        resp.raise_for_status()
        linhas = resp.json()
        return linhas[0] if linhas else {"produto_id": None, "status": "pendente"}

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/staging_produtos_ozklo",
        headers={
            **headers_auth,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
        params={"on_conflict": "url_origem"},
        json={"url_origem": url_origem, "dados": produto},
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f"Falha no upsert de staging: {resp.status_code} {resp.text}")
    return resp.json()[0]


def montar_variantes(variantes_brutas):
    return [
        {
            "id": v["id"],
            "produtoId": v["produtoId"],
            "sku": v["sku"],
            "tamanho": v["tamanho"],
            "cor": v["cor"],
            "quantidadeEstoque": v["quantidadeEstoque"],
            **({"precoOverride": v["precoOverride"]} if v.get("precoOverride") is not None else {}),
        }
        for v in variantes_brutas
    ]


def montar_imagens_por_cor_urls(produto, urls_imagens):
    """produto['imagensPorCorArquivos'] guarda nomes de arquivo locais (ver scraper.py); a
    ordem de upload em urls_imagens é a mesma de produto['arquivosImagens'], então dá pra
    montar o mapa arquivo->url final por posição, sem precisar re-subir nada."""
    arquivo_para_url = dict(zip(produto["arquivosImagens"], urls_imagens))
    imagens_por_cor_arquivos = produto.get("imagensPorCorArquivos") or {}

    imagens_por_cor = {}
    for cor, arquivos in imagens_por_cor_arquivos.items():
        urls = [arquivo_para_url[a] for a in arquivos if a in arquivo_para_url]
        if urls:
            imagens_por_cor[cor] = urls

    return imagens_por_cor or None


def montar_linha_produto_nova(produto, urls_imagens):
    slugs_categoria, _ = mapear_categorias(produto.get("categoriasSugeridas", []))
    return {
        "id": produto["id"],
        "nome": produto["nome"],
        "slug": produto["slug"],
        "descricao": produto["descricao"] or f"{produto['nome']} — descrição a revisar.",
        "preco_base": produto["precoBase"] or 0,
        "categorias": slugs_categoria,
        "imagens": urls_imagens,
        "imagens_por_cor": montar_imagens_por_cor_urls(produto, urls_imagens),
        "videos": None,
        "guia_medidas": None,
        "genero": "unissex",
        "peso_kg": None,
        "altura_cm": None,
        "largura_cm": None,
        "comprimento_cm": None,
        "variantes": montar_variantes(produto["variantes"]),
        "destaque": False,
        "ordem_destaque": None,
        "preco_promocional": produto.get("precoPromocional"),
    }


def calcular_diff_variantes(variantes_atuais, variantes_novas):
    """Casa por SKU. Sku novo -> adiciona; sku existente -> atualiza estoque/preço se mudou;
    nunca remove uma variante que só existe no produto atual (pode ter sido criada a mão no
    admin, ex. uma cor exclusiva sua)."""
    atuais_por_sku = {v["sku"]: v for v in variantes_atuais}
    resultado = list(variantes_atuais)
    mudou = False

    for nova in variantes_novas:
        existente = atuais_por_sku.get(nova["sku"])
        if existente is None:
            resultado.append(nova)
            mudou = True
            continue
        if existente.get("quantidadeEstoque") != nova.get("quantidadeEstoque"):
            existente["quantidadeEstoque"] = nova["quantidadeEstoque"]
            mudou = True
        if nova.get("precoOverride") is not None and existente.get("precoOverride") != nova.get("precoOverride"):
            existente["precoOverride"] = nova["precoOverride"]
            mudou = True

    return resultado, mudou


def calcular_diff_imagens(imagens_atuais, urls_novas):
    novas = [u for u in urls_novas if u not in imagens_atuais]
    if not novas:
        return imagens_atuais, False
    return imagens_atuais + novas, True


def buscar_produto_atual(headers_auth, produto_id):
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/produtos",
        headers=headers_auth,
        params={"id": f"eq.{produto_id}", "select": "*"},
        timeout=20,
    )
    resp.raise_for_status()
    linhas = resp.json()
    return linhas[0] if linhas else None


def montar_patch_atualizacao(produto_atual, produto_novo, urls_imagens):
    """Só entram no PATCH os campos que de fato mudaram (preço/variantes/imagens) — nome,
    descrição, slug e categoria do produto já existente nunca são tocados aqui, podem ter
    sido customizados no admin depois da última importação."""
    patch = {}

    preco_novo = produto_novo["precoBase"]
    if preco_novo is not None and produto_atual["preco_base"] != preco_novo:
        patch["preco_base"] = preco_novo

    promo_novo = produto_novo.get("precoPromocional")
    if produto_atual.get("preco_promocional") != promo_novo:
        patch["preco_promocional"] = promo_novo

    variantes_novas, variantes_mudaram = calcular_diff_variantes(
        produto_atual["variantes"], montar_variantes(produto_novo["variantes"])
    )
    if variantes_mudaram:
        patch["variantes"] = variantes_novas

    imagens_novas, imagens_mudaram = calcular_diff_imagens(produto_atual["imagens"], urls_imagens)
    if imagens_mudaram:
        patch["imagens"] = imagens_novas

    # Só preenche se ainda estiver vazio — não sobrescreve um imagens_por_cor que o admin já
    # tenha customizado depois da criação (ao contrário de imagens/variantes/preço, que são
    # sempre sincronizados com o que a OZKLO tem agora).
    if not produto_atual.get("imagens_por_cor"):
        imagens_por_cor = montar_imagens_por_cor_urls(produto_novo, urls_imagens)
        if imagens_por_cor:
            patch["imagens_por_cor"] = imagens_por_cor

    return patch


def enviar_imagens_produto(headers_auth, produto):
    urls = []
    for nome_arquivo in produto["arquivosImagens"]:
        caminho_local = os.path.join(produto["pastaImagensLocais"], nome_arquivo)
        caminho_storage = f"{produto['slug']}/{nome_arquivo}"
        urls.append(enviar_imagem(headers_auth, caminho_local, caminho_storage))
        print(f"   [OK] Imagem enviada: {caminho_storage}")
    return urls


def marcar_produtos_sumidos(headers_auth, urls_vistas_nesta_raspagem, dry_run):
    """scraper.py sempre varre o catálogo inteiro (não só uma amostra) — então qualquer
    produto já vinculado na staging cuja url_origem NÃO apareceu nesta rodada saiu do
    catálogo da OZKLO. Marca como esgotado (zera quantidadeEstoque de toda variante) em vez
    de apagar: reversível se ele voltar a existir lá, mantém histórico/avaliações."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/staging_produtos_ozklo",
        headers=headers_auth,
        params={"produto_id": "not.is.null", "select": "url_origem,produto_id"},
        timeout=30,
    )
    resp.raise_for_status()
    vinculados = resp.json()

    sumidos = [v for v in vinculados if v["url_origem"] not in urls_vistas_nesta_raspagem]
    if not sumidos:
        return 0

    marcados = 0
    for item in sumidos:
        produto_id = item["produto_id"]
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/produtos",
            headers=headers_auth,
            params={"id": f"eq.{produto_id}", "select": "id,nome,variantes"},
            timeout=20,
        )
        resp.raise_for_status()
        linhas = resp.json()
        if not linhas:
            continue  # produto já foi excluído manualmente — nada a fazer
        produto = linhas[0]

        ja_esgotado = all(v["quantidadeEstoque"] == 0 for v in produto["variantes"])
        if ja_esgotado:
            continue

        print(f"\n--- {produto['nome']} ({produto_id}) — sumiu do catálogo da OZKLO ---")
        if dry_run:
            print("   [SIMULADO] Seria marcado como esgotado (estoque de todas as variantes -> 0).")
            marcados += 1
            continue

        variantes_esgotadas = [{**v, "quantidadeEstoque": 0} for v in produto["variantes"]]
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/produtos?id=eq.{produto_id}",
            headers={**headers_auth, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={"variantes": variantes_esgotadas},
            timeout=30,
        )
        if not resp.ok:
            print(f"   [ERRO] Falha ao marcar como esgotado: {resp.status_code} {resp.text}")
            continue

        print("   [OK] Marcado como esgotado.")
        marcados += 1

    return marcados


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirmar", action="store_true", help="Grava de verdade no Supabase (sem isso, só simula).")
    args = parser.parse_args()

    email = os.environ.get("ADMIN_EMAIL")
    senha = os.environ.get("ADMIN_SENHA")
    if not email or not senha:
        print("Defina ADMIN_EMAIL e ADMIN_SENHA como variáveis de ambiente.")
        sys.exit(1)

    if not os.path.exists(CATALOGO_JSON):
        print(f"{CATALOGO_JSON} não encontrado — rode scraper.py primeiro.")
        sys.exit(1)

    with open(CATALOGO_JSON, "r", encoding="utf-8") as f:
        catalogo = json.load(f)

    print(f"{len(catalogo)} produtos no catálogo.")
    if not args.confirmar:
        print("\n*** DRY RUN — nada será gravado. Rode com --confirmar quando revisar os dados. ***\n")

    print("Logando como admin...")
    token = login(email, senha)
    headers_auth = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"}

    avisos_categoria = set()
    contagem = {"criados": 0, "atualizados": 0, "sem_mudanca": 0, "falhas": 0}

    for produto in catalogo:
        print(f"\n--- {produto['nome']} ({produto['id']}) ---")

        _, nao_mapeadas = mapear_categorias(produto.get("categoriasSugeridas", []))
        avisos_categoria.update(nao_mapeadas)

        try:
            staging = upsert_staging(headers_auth, produto, dry_run=not args.confirmar)
            produto_id_vinculado = staging.get("produto_id")

            if not produto_id_vinculado:
                # Nunca visto antes (nem raspado, nem vinculado manualmente) -> cria.
                if not args.confirmar:
                    print(f"   [SIMULADO] Produto novo — seria CRIADO com "
                          f"{len(produto['arquivosImagens'])} imagens, "
                          f"preco_base={produto['precoBase']}, "
                          f"{len(produto['variantes'])} variantes.")
                    contagem["criados"] += 1
                    continue

                urls_imagens = enviar_imagens_produto(headers_auth, produto)
                linha = montar_linha_produto_nova(produto, urls_imagens)
                resp = requests.post(
                    f"{SUPABASE_URL}/rest/v1/produtos",
                    headers={**headers_auth, "Content-Type": "application/json", "Prefer": "return=representation"},
                    json=linha,
                    timeout=30,
                )
                if not resp.ok:
                    raise RuntimeError(f"{resp.status_code} {resp.text}")
                produto_criado = resp.json()[0]

                requests.patch(
                    f"{SUPABASE_URL}/rest/v1/staging_produtos_ozklo?id=eq.{staging['id']}",
                    headers={**headers_auth, "Content-Type": "application/json", "Prefer": "return=minimal"},
                    json={"produto_id": produto_criado["id"], "status": "importado"},
                    timeout=20,
                ).raise_for_status()

                print(f"   [OK] Produto criado: {produto_criado['id']}")
                contagem["criados"] += 1
                continue

            # Já vinculado (importação anterior ou link manual do admin) -> atualiza só o
            # que mudou, sem mexer em nome/descrição/slug/categoria.
            produto_atual = buscar_produto_atual(headers_auth, produto_id_vinculado)
            if produto_atual is None:
                print(f"   [AVISO] Staging aponta pro produto {produto_id_vinculado!r}, que não "
                      f"existe mais (apagado?) — pulando, resolva manualmente na staging.")
                contagem["falhas"] += 1
                continue

            if not args.confirmar:
                # Sem subir imagem de verdade em dry-run, mas ainda dá pra prever se haveria
                # mudança de preço/estoque comparando com o que já está no banco.
                variantes_novas, variantes_mudariam = calcular_diff_variantes(
                    produto_atual["variantes"], montar_variantes(produto["variantes"])
                )
                preco_mudaria = produto["precoBase"] is not None and produto_atual["preco_base"] != produto["precoBase"]
                if preco_mudaria or variantes_mudariam:
                    print(f"   [SIMULADO] Já vinculado a {produto_id_vinculado} — teria "
                          f"ATUALIZAÇÃO (preço muda: {preco_mudaria}, variantes mudam: {variantes_mudariam}; "
                          f"imagens não checadas em dry-run).")
                    contagem["atualizados"] += 1
                else:
                    print(f"   [SIMULADO] Já vinculado a {produto_id_vinculado} — sem mudança "
                          f"de preço/estoque detectada (imagens não checadas em dry-run).")
                    contagem["sem_mudanca"] += 1
                continue

            urls_imagens = enviar_imagens_produto(headers_auth, produto)
            patch = montar_patch_atualizacao(produto_atual, produto, urls_imagens)

            if not patch:
                print(f"   [OK] Já vinculado a {produto_id_vinculado} — nada mudou.")
                contagem["sem_mudanca"] += 1
                continue

            resp = requests.patch(
                f"{SUPABASE_URL}/rest/v1/produtos?id=eq.{produto_id_vinculado}",
                headers={**headers_auth, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=patch,
                timeout=30,
            )
            if not resp.ok:
                raise RuntimeError(f"{resp.status_code} {resp.text}")

            print(f"   [OK] Produto {produto_id_vinculado} atualizado: {', '.join(patch.keys())}")
            contagem["atualizados"] += 1
        except Exception as e:
            print(f"   [ERRO] Falha ao processar {produto['id']}: {e}")
            contagem["falhas"] += 1

    urls_vistas = {produto["urlOrigem"] for produto in catalogo}
    marcados_esgotados = marcar_produtos_sumidos(headers_auth, urls_vistas, dry_run=not args.confirmar)

    print(f"\n{'=' * 60}")
    modo = "Confirmado" if args.confirmar else "Dry-run (nada gravado)"
    print(f"{modo}: {contagem['criados']} criados, {contagem['atualizados']} atualizados, "
          f"{contagem['sem_mudanca']} sem mudança, {contagem['falhas']} falhas, "
          f"{marcados_esgotados} marcados como esgotados (sumiram do catálogo da OZKLO).")
    if avisos_categoria:
        print(f"\nCategorias da OZKLO sem mapeamento em MAPA_CATEGORIAS (produto entra sem "
              f"categoria): {', '.join(sorted(avisos_categoria))}")


if __name__ == "__main__":
    main()
