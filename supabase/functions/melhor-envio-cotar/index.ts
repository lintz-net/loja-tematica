// Edge Function POST — recebe o CEP de destino + itens do carrinho (produtoId, quantidade),
// busca peso/dimensões reais no banco e cota o frete no Melhor Envio. Chamada pelo Angular
// no checkout (nunca fala com o Melhor Envio direto — CORS e client_secret exigem esse
// proxy).
import { chamarMelhorEnvio, corsHeaders } from '../_shared/melhor-envio.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const REMETENTE_CEP = Deno.env.get('REMETENTE_CEP')!;

/** Fallback pra produtos ainda sem peso/dimensão cadastrados pelo admin (colunas novas,
 * a maioria dos 128 produtos migrados do mock ainda está com isso em branco) — evita que o
 * checkout quebre por completo, mas o frete cotado não vai ser preciso até o admin
 * preencher os valores reais de cada produto. */
const PESO_PADRAO_KG = 0.3;
const DIMENSAO_PADRAO_CM = { altura: 5, largura: 20, comprimento: 25 };

interface ItemRequisicao {
  produtoId: string;
  quantidade: number;
}

interface LinhaProdutoDimensoes {
  id: string;
  preco_base: number;
  peso_kg: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
}

interface OpcaoFreteMelhorEnvio {
  id: number;
  name: string;
  price: string;
  delivery_time: number;
  company: { name: string };
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  try {
    const { cepDestino, itens } = (await req.json()) as {
      cepDestino: string;
      itens: ItemRequisicao[];
    };

    if (!cepDestino || !itens?.length) {
      return new Response(JSON.stringify({ error: 'cepDestino e itens são obrigatórios.' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const idsProdutos = itens.map((i) => i.produtoId);
    const respProdutos = await fetch(
      `${SUPABASE_URL}/rest/v1/produtos?select=id,preco_base,peso_kg,altura_cm,largura_cm,comprimento_cm&id=in.(${idsProdutos.join(',')})`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    if (!respProdutos.ok) {
      throw new Error(`Falha ao buscar produtos: ${await respProdutos.text()}`);
    }
    const produtos = (await respProdutos.json()) as LinhaProdutoDimensoes[];
    const produtosPorId = new Map(produtos.map((p) => [p.id, p]));

    const products = itens.map((item) => {
      const produto = produtosPorId.get(item.produtoId);
      return {
        id: item.produtoId,
        quantity: item.quantidade,
        weight: produto?.peso_kg ?? PESO_PADRAO_KG,
        height: produto?.altura_cm ?? DIMENSAO_PADRAO_CM.altura,
        width: produto?.largura_cm ?? DIMENSAO_PADRAO_CM.largura,
        length: produto?.comprimento_cm ?? DIMENSAO_PADRAO_CM.comprimento,
        insurance_value: produto?.preco_base ?? 0,
      };
    });

    const respostaCotacao = await chamarMelhorEnvio('/api/v2/me/shipment/calculate', {
      method: 'POST',
      body: JSON.stringify({
        from: { postal_code: REMETENTE_CEP },
        to: { postal_code: cepDestino.replace(/\D/g, '') },
        products,
      }),
    });

    if (!respostaCotacao.ok) {
      const corpo = await respostaCotacao.text();
      return new Response(JSON.stringify({ error: `Melhor Envio: ${corpo}` }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const opcoes = (await respostaCotacao.json()) as OpcaoFreteMelhorEnvio[];
    const opcoesValidas = opcoes
      .filter((o) => !o.error)
      .map((o) => ({
        id: o.id,
        transportadora: o.company.name,
        servico: o.name,
        prazoDias: o.delivery_time,
        preco: Number(o.price),
      }));

    return new Response(JSON.stringify(opcoesValidas), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (erro) {
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
