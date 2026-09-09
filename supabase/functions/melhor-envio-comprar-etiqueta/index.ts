// Compra manual de etiqueta — chamada pelo botão "Comprar etiqueta" em /admin/pedidos.
// Fluxo Melhor Envio: adicionar ao carrinho -> pagar (carteira) -> gerar -> imprimir.
// Qualquer falha em qualquer etapa marca o envio como 'pendente_etiqueta' com o erro
// registrado, SEM bloquear ou cancelar o pedido do cliente — o admin resolve manualmente.

import { chamarMelhorEnvio, corsHeaders, restSupabase } from '../_shared/melhor-envio.ts';

const REMETENTE_NOME = Deno.env.get('REMETENTE_NOME') ?? 'Izac Lins';
const REMETENTE_CPF = Deno.env.get('REMETENTE_DOCUMENTO') ?? '';
const REMETENTE_TELEFONE = Deno.env.get('REMETENTE_TELEFONE') ?? '';
const REMETENTE_EMAIL = Deno.env.get('REMETENTE_EMAIL') ?? 'lintz.net@gmail.com';
const REMETENTE_CEP = Deno.env.get('REMETENTE_CEP')!;
const REMETENTE_ENDERECO = Deno.env.get('REMETENTE_ENDERECO') ?? 'Rua Almirante Brasil';
const REMETENTE_NUMERO = Deno.env.get('REMETENTE_NUMERO') ?? '99';
const REMETENTE_BAIRRO = Deno.env.get('REMETENTE_BAIRRO') ?? 'Mooca';
const REMETENTE_CIDADE = Deno.env.get('REMETENTE_CIDADE') ?? 'São Paulo';
const REMETENTE_UF = Deno.env.get('REMETENTE_UF') ?? 'SP';

const PESO_PADRAO_KG = 0.3;
const DIMENSAO_PADRAO_CM = { altura: 5, largura: 20, comprimento: 25 };

interface EnderecoPedido {
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

interface ItemPedido {
  produtoNome: string;
  produtoSlug: string;
  quantidade: number;
  precoUnitario: number;
}

interface LinhaPedido {
  codigo: string;
  nome_cliente: string;
  email_cliente: string;
  telefone_cliente: string;
  endereco: EnderecoPedido;
  itens: ItemPedido[];
  valor_frete: number;
  frete_servico_id: string | null;
}

interface LinhaProdutoDimensoes {
  slug: string;
  peso_kg: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
}

interface LinhaEnvio {
  id: string;
  codigo_pedido: string;
  status_envio: string;
}

async function obterOuCriarEnvio(pedido: LinhaPedido): Promise<LinhaEnvio> {
  const existentes = await restSupabase<LinhaEnvio[]>(
    `envios?codigo_pedido=eq.${pedido.codigo}&select=*`
  );
  if (existentes[0]) return existentes[0];

  const criados = await restSupabase<LinhaEnvio[]>('envios', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      codigo_pedido: pedido.codigo,
      transportadora: null,
      servico_nome: null,
      status_envio: 'aguardando_compra',
    }),
  });
  return criados[0];
}

async function marcarPendente(idEnvio: string, erro: string): Promise<void> {
  await restSupabase(`envios?id=eq.${idEnvio}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status_envio: 'pendente_etiqueta',
      erro_compra_etiqueta: erro,
      atualizado_em: new Date().toISOString(),
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const jsonHeaders = { ...corsHeaders(), 'Content-Type': 'application/json' };
  let idEnvio: string | null = null;

  try {
    const { codigoPedido } = (await req.json()) as { codigoPedido: string };
    if (!codigoPedido) {
      return new Response(JSON.stringify({ error: 'codigoPedido é obrigatório.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const pedidos = await restSupabase<LinhaPedido[]>(
      `pedidos?codigo=eq.${codigoPedido}&select=codigo,nome_cliente,email_cliente,telefone_cliente,endereco,itens,valor_frete,frete_servico_id`
    );
    const pedido = pedidos[0];
    if (!pedido) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }
    if (!pedido.frete_servico_id) {
      return new Response(
        JSON.stringify({ error: 'Pedido não tem serviço de frete selecionado.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const envio = await obterOuCriarEnvio(pedido);
    idEnvio = envio.id;

    const slugs = pedido.itens.map((item) => item.produtoSlug);
    const produtos = await restSupabase<LinhaProdutoDimensoes[]>(
      `produtos?select=slug,peso_kg,altura_cm,largura_cm,comprimento_cm&slug=in.(${slugs.join(',')})`
    );
    const produtosPorSlug = new Map(produtos.map((p) => [p.slug, p]));

    // Um volume por unidade — simplificação razoável pra um pacote de produtos pequenos.
    const volumes = pedido.itens.flatMap((item) => {
      const produto = produtosPorSlug.get(item.produtoSlug);
      return Array.from({ length: item.quantidade }, () => ({
        height: produto?.altura_cm ?? DIMENSAO_PADRAO_CM.altura,
        width: produto?.largura_cm ?? DIMENSAO_PADRAO_CM.largura,
        length: produto?.comprimento_cm ?? DIMENSAO_PADRAO_CM.comprimento,
        weight: produto?.peso_kg ?? PESO_PADRAO_KG,
      }));
    });

    const valorSegurado = pedido.itens.reduce(
      (soma, item) => soma + item.precoUnitario * item.quantidade,
      0
    );

    // Verificação de saldo é best-effort: se a rota de saldo mudar de formato, seguimos e
    // deixamos o checkout (etapa seguinte) ser a fonte real de verdade sobre saldo insuficiente.
    try {
      const respSaldo = await chamarMelhorEnvio('/api/v2/me/balance');
      if (respSaldo.ok) {
        const saldo = (await respSaldo.json()) as { balance?: number };
        if (typeof saldo.balance === 'number' && saldo.balance < pedido.valor_frete) {
          await marcarPendente(
            idEnvio,
            `Saldo insuficiente na carteira do Melhor Envio (saldo: R$${saldo.balance}, frete: R$${pedido.valor_frete}).`
          );
          return new Response(
            JSON.stringify({ error: 'Saldo insuficiente na carteira do Melhor Envio.' }),
            { status: 422, headers: jsonHeaders }
          );
        }
      }
    } catch {
      // segue mesmo sem confirmar o saldo — ver comentário acima
    }

    const corpoCarrinho = {
      service: Number(pedido.frete_servico_id),
      from: {
        name: REMETENTE_NOME,
        phone: REMETENTE_TELEFONE,
        email: REMETENTE_EMAIL,
        document: REMETENTE_CPF,
        address: REMETENTE_ENDERECO,
        number: REMETENTE_NUMERO,
        district: REMETENTE_BAIRRO,
        city: REMETENTE_CIDADE,
        state_abbr: REMETENTE_UF,
        postal_code: REMETENTE_CEP,
        country_id: 'BR',
      },
      to: {
        name: pedido.nome_cliente,
        phone: pedido.telefone_cliente,
        email: pedido.email_cliente,
        address: pedido.endereco.endereco,
        number: pedido.endereco.numero,
        district: pedido.endereco.bairro,
        city: pedido.endereco.cidade,
        state_abbr: pedido.endereco.uf,
        postal_code: pedido.endereco.cep.replace(/\D/g, ''),
        country_id: 'BR',
      },
      products: pedido.itens.map((item) => ({
        name: item.produtoNome,
        quantity: String(item.quantidade),
        unitary_value: String(item.precoUnitario),
      })),
      volumes,
      options: {
        insurance_value: valorSegurado,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: true,
        platform: 'Vista Nostalgica',
        tags: [{ tag: pedido.codigo }],
      },
    };

    const respCarrinho = await chamarMelhorEnvio('/api/v2/me/cart', {
      method: 'POST',
      body: JSON.stringify(corpoCarrinho),
    });
    if (!respCarrinho.ok) {
      const corpo = await respCarrinho.text();
      await marcarPendente(idEnvio, `Falha ao adicionar ao carrinho: ${corpo}`);
      return new Response(JSON.stringify({ error: `Melhor Envio (carrinho): ${corpo}` }), {
        status: 502,
        headers: jsonHeaders,
      });
    }
    const carrinho = (await respCarrinho.json()) as { id: string };
    const idMelhorEnvio = carrinho.id;

    const respCheckout = await chamarMelhorEnvio('/api/v2/me/shipment/checkout', {
      method: 'POST',
      body: JSON.stringify({ orders: [idMelhorEnvio] }),
    });
    if (!respCheckout.ok) {
      const corpo = await respCheckout.text();
      await marcarPendente(idEnvio, `Falha ao pagar (saldo/carteira): ${corpo}`);
      return new Response(JSON.stringify({ error: `Melhor Envio (checkout): ${corpo}` }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    const respGerar = await chamarMelhorEnvio('/api/v2/me/shipment/generate', {
      method: 'POST',
      body: JSON.stringify({ orders: [idMelhorEnvio] }),
    });
    if (!respGerar.ok) {
      const corpo = await respGerar.text();
      await marcarPendente(idEnvio, `Falha ao gerar etiqueta: ${corpo}`);
      return new Response(JSON.stringify({ error: `Melhor Envio (gerar): ${corpo}` }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    let urlEtiqueta: string | null = null;
    try {
      const respImprimir = await chamarMelhorEnvio('/api/v2/me/shipment/print', {
        method: 'POST',
        body: JSON.stringify({ mode: 'private', orders: [idMelhorEnvio] }),
      });
      if (respImprimir.ok) {
        const dados = (await respImprimir.json()) as { url?: string };
        urlEtiqueta = dados.url ?? null;
      }
    } catch {
      // não bloqueia — a URL de impressão pode ser obtida depois, o essencial (compra) já foi feito
    }

    await restSupabase(`envios?id=eq.${idEnvio}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id_melhor_envio: idMelhorEnvio,
        url_etiqueta: urlEtiqueta,
        status_envio: 'gerado',
        erro_compra_etiqueta: null,
        atualizado_em: new Date().toISOString(),
      }),
    });

    return new Response(JSON.stringify({ ok: true, idMelhorEnvio, urlEtiqueta }), {
      headers: jsonHeaders,
    });
  } catch (erro) {
    if (idEnvio) {
      await marcarPendente(idEnvio, String(erro)).catch(() => {});
    }
    return new Response(JSON.stringify({ error: String(erro) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
