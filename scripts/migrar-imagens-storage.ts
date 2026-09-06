/**
 * Migração única: sobe as imagens de produtos de public/imagens/produtos/<slug>/ pro
 * Supabase Storage (bucket "produtos") e atualiza `imagens`/`imagens_por_cor` na tabela
 * `produtos` pra apontar pras novas URLs públicas do Storage.
 *
 * Rodar com (não commitar as credenciais, só passar na hora):
 *   ADMIN_EMAIL=seu@email.com ADMIN_SENHA=suasenha npx tsx scripts/migrar-imagens-storage.ts
 *
 * Precisa logar como admin (mesmo usuário de /admin/login) porque a policy de escrita no
 * Storage e de update em `produtos` exige role 'authenticated'. Usa `fetch` puro (não o
 * cliente `@supabase/supabase-js`) pra evitar o RealtimeClient interno, que trava
 * indefinidamente em Node < 22 ao processar o login (mesmo problema já resolvido no app —
 * ver TODO.md).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = 'https://tmrtyotlvrznavjorkay.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C-19JMHS11IjYHJ4ngIFQw_wfojX8DA';
const PASTA_IMAGENS = join(__dirname, '../public/imagens/produtos');
const BUCKET = 'produtos';

interface Produto {
  id: string;
  slug: string;
  imagens: string[];
  imagens_por_cor: Record<string, string[]> | null;
}

async function login(email: string, senha: string): Promise<string> {
  const resposta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!resposta.ok) {
    throw new Error(`Login falhou: ${resposta.status} ${await resposta.text()}`);
  }
  const dados = (await resposta.json()) as { access_token: string };
  return dados.access_token;
}

function nomeArquivo(caminho: string): string {
  return caminho.split('/').pop()!;
}

async function main() {
  const email = process.env['ADMIN_EMAIL'];
  const senha = process.env['ADMIN_SENHA'];
  if (!email || !senha) {
    console.error('Defina ADMIN_EMAIL e ADMIN_SENHA como variáveis de ambiente.');
    process.exit(1);
  }

  console.log('Logando como admin...');
  const token = await login(email, senha);
  const headersAuth = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  };

  console.log('Buscando produtos...');
  const respProdutos = await fetch(
    `${SUPABASE_URL}/rest/v1/produtos?select=id,slug,imagens,imagens_por_cor`,
    { headers: headersAuth }
  );
  if (!respProdutos.ok) {
    throw new Error(`Falha ao buscar produtos: ${respProdutos.status} ${await respProdutos.text()}`);
  }
  const produtos = (await respProdutos.json()) as Produto[];

  let totalArquivos = 0;
  let totalProdutos = 0;

  for (const produto of produtos) {
    const pastaProduto = join(PASTA_IMAGENS, produto.slug);
    let arquivos: string[];
    try {
      arquivos = readdirSync(pastaProduto);
    } catch {
      console.warn(`Sem pasta local de imagens pra ${produto.slug}, pulando.`);
      continue;
    }

    const mapaUrls = new Map<string, string>();

    for (const arquivo of arquivos) {
      const caminhoLocal = join(pastaProduto, arquivo);
      const caminhoStorage = `${produto.slug}/${arquivo}`;
      const conteudo = readFileSync(caminhoLocal);

      const respUpload = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${caminhoStorage}`,
        {
          method: 'POST',
          headers: {
            ...headersAuth,
            'Content-Type': 'image/webp',
            'x-upsert': 'true',
          },
          body: conteudo,
        }
      );
      if (!respUpload.ok) {
        console.error(`Falha ao subir ${caminhoStorage}: ${respUpload.status} ${await respUpload.text()}`);
        continue;
      }

      mapaUrls.set(arquivo, `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${caminhoStorage}`);
      totalArquivos++;
    }

    const imagensNovas = produto.imagens.map((c) => mapaUrls.get(nomeArquivo(c)) ?? c);

    let imagensPorCorNovas: Record<string, string[]> | null = null;
    if (produto.imagens_por_cor) {
      imagensPorCorNovas = {};
      for (const [cor, caminhos] of Object.entries(produto.imagens_por_cor)) {
        imagensPorCorNovas[cor] = caminhos.map((c) => mapaUrls.get(nomeArquivo(c)) ?? c);
      }
    }

    const respUpdate = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${produto.id}`, {
      method: 'PATCH',
      headers: { ...headersAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ imagens: imagensNovas, imagens_por_cor: imagensPorCorNovas }),
    });
    if (!respUpdate.ok) {
      console.error(`Falha ao atualizar produto ${produto.slug}: ${respUpdate.status} ${await respUpdate.text()}`);
      continue;
    }

    totalProdutos++;
    console.log(`OK: ${produto.slug} (${arquivos.length} imagens)`);
  }

  console.log(`\nConcluído: ${totalProdutos} produtos atualizados, ${totalArquivos} imagens enviadas.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
