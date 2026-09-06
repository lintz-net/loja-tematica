import { Routes } from '@angular/router';
import { DadosPaginaInstitucional } from './features/institucional/pagina-institucional.component';
import { adminGuard } from './core/guards/admin.guard';

const PAGINA_COMO_COMPRAR: DadosPaginaInstitucional = {
  titulo: 'Como comprar',
  paragrafos: [
    'Comprar online nunca foi tão simples! Para garantir que você tenha uma experiência rápida, segura e sem complicações, preparamos este guia prático com todas as etapas para você finalizar sua compra com tranquilidade.',
  ],
  passos: [
    {
      titulo: '1. Escolha o produto ideal',
      texto:
        'Navegue pelo nosso catálogo e encontre o produto perfeito para você. Utilize filtros, categorias ou a busca para localizar exatamente o que deseja.',
    },
    {
      titulo: '2. Adicione ao carrinho',
      texto:
        'Ao encontrar o item, clique em "Adicionar ao carrinho" para reservar o produto. Você pode continuar explorando e adicionando outros produtos ou ir direto para a próxima etapa.',
    },
    {
      titulo: '3. Inicie a compra',
      texto: 'Quando estiver pronto para concluir, clique em "Iniciar compra" para começar o processo de finalização.',
    },
    {
      titulo: '4. Preencha seus dados de contato',
      texto:
        'Para que possamos entrar em contato e enviar suas informações, complete o formulário com seus dados pessoais e clique em "Continuar".',
    },
    {
      titulo: '5. Informe o endereço de entrega',
      texto:
        'Digite o endereço onde deseja receber seu pedido. Certifique-se de que as informações estejam corretas para evitar atrasos.',
    },
    {
      titulo: '6. Escolha a forma de frete',
      texto:
        'Selecione a opção de frete que melhor atende às suas necessidades — seja rapidez, custo ou conveniência. Depois, clique em "Continuar".',
    },
    {
      titulo: '7. Selecione o meio de pagamento',
      texto:
        'Oferecemos diversas formas de pagamento para sua comodidade, como Pix e cartão de crédito. Após escolher, clique em "Continuar".',
    },
    {
      titulo: '8. Revise e confirme seu pedido',
      texto:
        'Antes de finalizar, você terá a chance de rever todos os detalhes da sua compra — produtos, endereço, frete e pagamento. Confirme se tudo está correto e finalize seu pedido.',
    },
    {
      titulo: '9. Receba a confirmação por e-mail',
      texto:
        'Assim que o pedido for confirmado, enviaremos um e-mail com todos os detalhes para que você acompanhe o status da sua compra.',
    },
    {
      titulo: '10. Pagamento e envio',
      texto:
        'Após a confirmação do pagamento, enviaremos o comprovante e prepararemos seu pedido para envio. Em breve, ele estará na sua casa!',
    },
  ],
};

const PAGINA_QUEM_SOMOS: DadosPaginaInstitucional = {
  titulo: 'Quem somos',
  paragrafos: [
    'A Vista Nostálgica é uma vitrine para descobrir camisetas, bermudas e polos com estampas que remetem a games, cinema, música, futebol, carros e humor.',
    'Trabalhamos com fornecedores especializados em estampas DTF e emborrachada, com curadoria própria — cada peça é escolhida pensando em quem quer vestir uma lembrança, não só uma camiseta.',
  ],
  nota: 'Página de exemplo com conteúdo fictício, criada para validar a estrutura da loja.',
};

const PAGINA_POLITICA_PRIVACIDADE: DadosPaginaInstitucional = {
  titulo: 'Política de privacidade',
  paragrafos: [
    'Coletamos apenas os dados necessários para processar seu pedido: nome, e-mail, telefone e endereço de entrega.',
    'Essas informações são usadas exclusivamente para viabilizar a compra — comunicação sobre o pedido, entrega e suporte — e não são compartilhadas com terceiros além dos parceiros de logística e pagamento estritamente necessários para concluir a transação.',
  ],
  nota: 'Página de exemplo com conteúdo fictício. Antes de operar de verdade, esse texto precisa ser revisado por um advogado e adequado à LGPD.',
};

const PAGINA_TROCAS_DEVOLUCOES: DadosPaginaInstitucional = {
  titulo: 'Trocas e devoluções',
  paragrafos: [
    'Na nossa loja, prezamos pela sua satisfação e oferecemos opções práticas para que você possa trocar ou devolver produtos adquiridos de forma simples e rápida.',
  ],
  secoes: [
    {
      titulo: 'Onde trocar ou devolver?',
      paragrafos: [
        'Pelo e-mail: envie uma mensagem para contato@vistanostalgica.com.br solicitando a troca ou devolução. Entraremos em contato o mais breve possível para orientá-lo sobre os próximos passos e o envio do produto.',
      ],
    },
    {
      titulo: 'Prazo para trocas e devoluções',
      paragrafos: [
        'É importante lembrar que as devoluções só são aceitas dentro do prazo máximo de 15 dias corridos após a data da compra. Esse prazo está em conformidade com o Código de Defesa do Consumidor, garantindo seus direitos de forma justa.',
      ],
    },
    {
      titulo: 'Condições para troca e devolução',
      paragrafos: ['Para que possamos processar sua solicitação, o produto deve estar:'],
      lista: [
        'Em perfeito estado de conservação;',
        'Com todas as etiquetas e embalagens originais intactas;',
        'Sem sinais de uso ou danos causados pelo consumidor.',
      ],
    },
    {
      titulo: 'Passo a passo para realizar a troca ou devolução',
      passos: [
        { titulo: '1. Verifique as condições', texto: 'Verifique se o produto atende às condições acima.' },
        { titulo: '2. Apresente o comprovante', texto: 'Apresente o ticket de compra ou comprovante.' },
        {
          titulo: '3. Aguarde as instruções',
          texto: 'Aguarde as instruções para o envio do produto, caso opte pelo atendimento via e-mail.',
        },
        {
          titulo: '4. Receba a confirmação',
          texto: 'Após receber e analisar o produto devolvido, confirmaremos a troca ou o reembolso.',
        },
      ],
    },
    {
      titulo: 'Dúvidas?',
      paragrafos: [
        'Estamos à disposição para esclarecer qualquer dúvida sobre nosso processo de trocas e devoluções. Garantimos transparência e agilidade para que sua experiência seja sempre positiva.',
        'Lembre-se: conhecer seus direitos e seguir os procedimentos corretos facilita todo o processo.',
      ],
    },
  ],
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/catalogo/pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'categoria/:slug',
    loadComponent: () =>
      import('./features/catalogo/pages/listagem/listagem.component').then(
        (m) => m.ListagemComponent
      ),
  },
  {
    path: 'produto/:slug',
    loadComponent: () =>
      import('./features/catalogo/pages/detalhe-produto/detalhe-produto.component').then(
        (m) => m.DetalheProdutoComponent
      ),
  },
  {
    path: 'favoritos',
    loadComponent: () =>
      import('./features/favoritos/pages/favoritos/favoritos.component').then(
        (m) => m.FavoritosComponent
      ),
  },
  {
    path: 'carrinho',
    loadComponent: () =>
      import('./features/carrinho/pages/carrinho/carrinho.component').then(
        (m) => m.CarrinhoComponent
      ),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./features/checkout/pages/checkout/checkout.component').then(
        (m) => m.CheckoutComponent
      ),
  },
  {
    path: 'pedido/:codigo',
    loadComponent: () =>
      import('./features/pedido/pages/pedido/pedido.component').then((m) => m.PedidoComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/pages/login/admin-login.component').then(
        (m) => m.AdminLoginComponent
      ),
  },
  {
    path: 'admin/pedidos',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/pages/pedidos/admin-pedidos.component').then(
        (m) => m.AdminPedidosComponent
      ),
  },
  {
    path: 'conta',
    loadComponent: () =>
      import('./features/conta/pages/conta/conta.component').then((m) => m.ContaComponent),
  },
  {
    path: 'como-comprar',
    loadComponent: () =>
      import('./features/institucional/pagina-institucional.component').then(
        (m) => m.PaginaInstitucionalComponent
      ),
    data: { pagina: PAGINA_COMO_COMPRAR },
  },
  {
    path: 'quem-somos',
    loadComponent: () =>
      import('./features/institucional/pagina-institucional.component').then(
        (m) => m.PaginaInstitucionalComponent
      ),
    data: { pagina: PAGINA_QUEM_SOMOS },
  },
  {
    path: 'politica-privacidade',
    loadComponent: () =>
      import('./features/institucional/pagina-institucional.component').then(
        (m) => m.PaginaInstitucionalComponent
      ),
    data: { pagina: PAGINA_POLITICA_PRIVACIDADE },
  },
  {
    path: 'trocas-devolucoes',
    loadComponent: () =>
      import('./features/institucional/pagina-institucional.component').then(
        (m) => m.PaginaInstitucionalComponent
      ),
    data: { pagina: PAGINA_TROCAS_DEVOLUCOES },
  },
  { path: '**', redirectTo: '' },
];
