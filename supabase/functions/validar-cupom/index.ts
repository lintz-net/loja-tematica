// Edge Function POST — valida um código de cupom no checkout. A tabela `cupons` só é
// legível por admin (RLS), então essa validação passa pela service_role aqui, nunca por um
// select direto do navegador (que exporia todos os códigos/percentuais ativos pra qualquer
// um que inspecionasse a requisição).
//
// Recebe os itens do carrinho (não um subtotal pronto) e recalcula tudo aqui — o subtotal
// nunca é confiado do cliente, sempre somado a partir de `itens`. Isso também é o que permite
// calcular desconto restrito por categoria/produto: só os itens que batem com a regra do
// cupom entram na conta (ver `migration-031-cupons-robustos.sql`).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface LinhaCupom {
  codigo: string;
  tipo_desconto: 'percentual' | 'valor_fixo';
  valor_desconto: number;
  expira_em: string | null;
  ativo: boolean;
  valor_minimo_pedido: number | null;
  limite_uso_por_email: number | null;
  categorias: string[] | null;
  produtos_ids: string[] | null;
}

interface ItemRequisicao {
  produtoId: string;
  categorias: string[];
  precoUnitario: number;
  quantidade: number;
}

interface PayloadRequisicao {
  codigo: string;
  itens: ItemRequisicao[];
  /** Opcional de propósito: sem e-mail ainda (cliente não chegou no passo de contato), não dá
   * pra checar limite de uso por e-mail — a validação segue sem essa checagem específica,
   * refeita de novo (com e-mail dessa vez) na hora de fato pagar, pelo backend do pedido. */
  email?: string;
}

function itemElegivel(item: ItemRequisicao, categorias: string[] | null, produtosIds: string[] | null): boolean {
  const semRestricao = (!categorias || categorias.length === 0) && (!produtosIds || produtosIds.length === 0);
  if (semRestricao) return true;

  const bateCategoria = !!categorias?.length && item.categorias.some((c) => categorias.includes(c));
  const bateProduto = !!produtosIds?.length && produtosIds.includes(item.produtoId);
  return bateCategoria || bateProduto;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const jsonHeaders = { ...corsHeaders(), 'Content-Type': 'application/json' };
  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: jsonHeaders });

  try {
    const { codigo, itens, email } = (await req.json()) as PayloadRequisicao;
    if (!codigo || !Array.isArray(itens) || itens.length === 0) {
      return respostaJson({ valido: false, motivo: 'Dados inválidos.' }, 400);
    }

    const codigoNormalizado = codigo.trim().toUpperCase();

    const respostaCupom = await fetch(
      `${SUPABASE_URL}/rest/v1/cupons?codigo=eq.${encodeURIComponent(codigoNormalizado)}&select=*`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    if (!respostaCupom.ok) throw new Error(`Falha ao consultar cupom: ${await respostaCupom.text()}`);

    const linhas = (await respostaCupom.json()) as LinhaCupom[];
    const cupom = linhas[0];

    if (!cupom) return respostaJson({ valido: false, motivo: 'Cupom não encontrado.' });
    if (!cupom.ativo) return respostaJson({ valido: false, motivo: 'Cupom inativo.' });
    if (cupom.expira_em && new Date(cupom.expira_em).getTime() < Date.now()) {
      return respostaJson({ valido: false, motivo: 'Cupom expirado.' });
    }

    const subtotal = itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
    if (cupom.valor_minimo_pedido != null && subtotal < cupom.valor_minimo_pedido) {
      const minimo = cupom.valor_minimo_pedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return respostaJson({ valido: false, motivo: `Pedido mínimo de ${minimo} pra usar esse cupom.` });
    }

    if (cupom.limite_uso_por_email != null && email) {
      const respostaUso = await fetch(
        `${SUPABASE_URL}/rest/v1/pedidos?select=codigo&email_cliente=eq.${encodeURIComponent(email)}&cupom_codigo=eq.${encodeURIComponent(cupom.codigo)}`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
      );
      if (!respostaUso.ok) throw new Error(`Falha ao consultar uso do cupom: ${await respostaUso.text()}`);
      const pedidosComCupom = (await respostaUso.json()) as unknown[];
      if (pedidosComCupom.length >= cupom.limite_uso_por_email) {
        return respostaJson({ valido: false, motivo: 'Você já usou esse cupom o máximo de vezes permitido.' });
      }
    }

    const itensElegiveis = itens.filter((item) => itemElegivel(item, cupom.categorias, cupom.produtos_ids));
    if (itensElegiveis.length === 0) {
      return respostaJson({ valido: false, motivo: 'Esse cupom não se aplica aos itens do seu carrinho.' });
    }

    const subtotalElegivel = itensElegiveis.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
    const descontoBruto =
      cupom.tipo_desconto === 'percentual'
        ? subtotalElegivel * (cupom.valor_desconto / 100)
        : cupom.valor_desconto;
    // Nunca desconta mais que o subtotal elegível (evita zerar/negativar itens que não batem
    // com a regra do cupom, com um cupom de valor fixo alto).
    const desconto = Math.min(descontoBruto, subtotalElegivel);

    return respostaJson({
      valido: true,
      codigo: cupom.codigo,
      tipoDesconto: cupom.tipo_desconto,
      valorDesconto: cupom.valor_desconto,
      desconto,
    });
  } catch (erro) {
    return respostaJson({ valido: false, motivo: String(erro) }, 500);
  }
});
