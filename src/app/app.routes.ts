import { Routes } from '@angular/router';
import { DadosPaginaInstitucional } from './features/institucional/pagina-institucional.component';
import { adminGuard } from './core/guards/admin.guard';
import { descartarAlteracoesGuard } from './core/guards/descartar-alteracoes.guard';

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
    'A Vista Nostálgica nasceu da vontade de transformar lembranças em algo pra vestir. Cada estampa do nosso catálogo carrega uma referência de games, cinema, música, futebol, carros ou humor — peças pensadas pra quem quer contar uma história, não só usar uma camiseta.',
  ],
  secoes: [
    {
      titulo: 'Nossa missão',
      icone: 'coracao',
      paragrafos: [
        'Acreditamos que roupa também é forma de expressão. Nossa missão é oferecer estampas com identidade — de qualidade, com curadoria própria e a um preço justo — pra quem quer carregar um pedaço da cultura pop no dia a dia.',
      ],
    },
    {
      titulo: 'Curadoria e qualidade',
      icone: 'estrela',
      paragrafos: [
        'Trabalhamos com fornecedores especializados em estampas DTF e emborrachada, feitas pra durar lavagem após lavagem sem rachar ou desbotar. Cada peça passa por curadoria própria antes de entrar no site — só entra o que a gente mesmo usaria.',
      ],
    },
    {
      titulo: 'Compra segura, do pedido à entrega',
      icone: 'escudo',
      lista: [
        'Pagamento processado por parceiro homologado, com Pix e cartão de crédito.',
        'Frete calculado em tempo real e etiqueta gerada por transportadoras parceiras confiáveis.',
        'Acompanhamento do pedido disponível a qualquer momento, direto pelo link enviado por e-mail.',
      ],
    },
    {
      titulo: 'Atendimento de verdade',
      icone: 'email',
      paragrafos: [
        'Time pequeno, atendimento próximo. Dúvida antes de comprar, troca ou devolução — é só chamar no WhatsApp ou mandar um e-mail pra contato@vistanostalgica.com.br que a gente responde.',
      ],
    },
  ],
};

const PAGINA_POLITICA_PRIVACIDADE: DadosPaginaInstitucional = {
  titulo: 'Política de privacidade',
  selo: 'Atualizada em setembro de 2026',
  paragrafos: [
    'A Vista Nostálgica respeita a sua privacidade e leva a proteção dos seus dados a sério. Esta política explica quais informações coletamos quando você visita nosso site ou faz uma compra, como usamos esses dados, com quem eventualmente compartilhamos e quais direitos você tem sobre eles, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).',
  ],
  secoes: [
    {
      titulo: 'Quais dados coletamos',
      icone: 'base-dados',
      paragrafos: [
        'Coletamos apenas os dados necessários para viabilizar sua compra e melhorar sua experiência na loja:',
      ],
      lista: [
        'Dados de identificação e contato: nome, e-mail e telefone/WhatsApp.',
        'Dados de entrega: endereço completo e CPF ou CNPJ (este último exigido pela transportadora para emissão da etiqueta de envio).',
        'Dados do pedido: itens comprados, valores, forma de pagamento escolhida e status da entrega.',
        'Dados de navegação: páginas visitadas e itens no carrinho, usados apenas para o funcionamento do site (nenhum cookie de rastreamento de terceiros está ativo hoje).',
      ],
    },
    {
      titulo: 'Como usamos seus dados',
      icone: 'escudo',
      paragrafos: [
        'Usamos suas informações exclusivamente para as seguintes finalidades:',
      ],
      lista: [
        'Processar e confirmar seu pedido, incluindo cobrança e emissão de etiqueta de envio.',
        'Comunicar atualizações sobre o pedido (confirmação de compra, status de envio e entrega).',
        'Prestar suporte quando você entra em contato conosco.',
        'Cumprir obrigações legais e fiscais, quando aplicável.',
      ],
    },
    {
      titulo: 'Com quem compartilhamos',
      icone: 'compartilhar',
      paragrafos: [
        'Não vendemos nem alugamos seus dados para fins de marketing de terceiros. Compartilhamos apenas o estritamente necessário com parceiros que viabilizam a operação da loja:',
      ],
      lista: [
        'Processador de pagamento (Mercado Pago), para viabilizar a cobrança do pedido.',
        'Melhor Envio e as transportadoras parceiras (Correios, Jadlog e outras), para calcular o frete e realizar a entrega.',
        'Provedores de infraestrutura (hospedagem e banco de dados), que armazenam as informações de forma segura em nosso nome.',
      ],
    },
    {
      titulo: 'Cookies e tecnologias semelhantes',
      icone: 'cookie',
      paragrafos: [
        'Usamos cookies essenciais para o funcionamento do site — por exemplo, para manter os itens do seu carrinho enquanto você navega. Não usamos, no momento, cookies de rastreamento ou pixels de publicidade de terceiros; caso isso mude no futuro, esta política será atualizada e o consentimento será solicitado antes de qualquer cookie não essencial ser carregado.',
      ],
    },
    {
      titulo: 'Segurança dos dados',
      icone: 'cadeado',
      paragrafos: [
        'Adotamos medidas técnicas para proteger suas informações: conexão criptografada (HTTPS) em todo o site, banco de dados com controle de acesso restrito e autenticação obrigatória para qualquer acesso administrativo aos pedidos. Apesar dos cuidados, nenhum sistema é 100% livre de riscos — caso identifiquemos qualquer incidente de segurança que afete seus dados, você será notificado conforme exigido pela LGPD.',
      ],
    },
    {
      titulo: 'Seus direitos como titular dos dados',
      icone: 'escudo',
      paragrafos: [
        'De acordo com a LGPD, você tem direito a:',
      ],
      lista: [
        'Confirmar a existência de tratamento dos seus dados.',
        'Acessar os dados que temos sobre você.',
        'Corrigir dados incompletos, inexatos ou desatualizados.',
        'Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.',
        'Solicitar a portabilidade dos dados a outro fornecedor.',
        'Revogar o consentimento e solicitar a eliminação dos dados tratados com base nele.',
      ],
    },
    {
      titulo: 'Por quanto tempo guardamos seus dados',
      icone: 'base-dados',
      paragrafos: [
        'Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política e as obrigações legais e fiscais aplicáveis (por exemplo, comprovantes de venda). Após esse período, os dados são eliminados ou anonimizados com segurança.',
      ],
    },
    {
      titulo: 'Alterações desta política',
      icone: 'escudo',
      paragrafos: [
        'Esta política pode ser atualizada periodicamente para refletir mudanças na forma como operamos ou na legislação aplicável. A data no topo desta página indica a versão mais recente.',
      ],
    },
    {
      titulo: 'Fale conosco',
      icone: 'email',
      paragrafos: [
        'Para dúvidas sobre esta política ou para exercer qualquer um dos seus direitos como titular de dados, entre em contato pelo e-mail contato@vistanostalgica.com.br.',
      ],
    },
  ],
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
    // Layout compartilhado (nav lateral + sair) pras telas atrás de login — `admin/login`
    // fica de fora de propósito (nav não faz sentido antes de autenticar).
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/componentes/admin-shell/admin-shell.component').then(
        (m) => m.AdminShellComponent
      ),
    children: [
      // Digitar só /admin (ou cair aqui logo após o login) já leva pro dashboard, em vez de
      // uma área em branco dentro do layout.
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/pages/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'pedidos',
        loadComponent: () =>
          import('./features/admin/pages/pedidos/admin-pedidos.component').then(
            (m) => m.AdminPedidosComponent
          ),
      },
      {
        path: 'produtos',
        loadComponent: () =>
          import('./features/admin/pages/produtos/admin-produtos.component').then(
            (m) => m.AdminProdutosComponent
          ),
      },
      {
        path: 'produtos/novo',
        canDeactivate: [descartarAlteracoesGuard],
        loadComponent: () =>
          import('./features/admin/pages/produto-form/admin-produto-form.component').then(
            (m) => m.AdminProdutoFormComponent
          ),
      },
      {
        path: 'produtos/:id/editar',
        canDeactivate: [descartarAlteracoesGuard],
        loadComponent: () =>
          import('./features/admin/pages/produto-form/admin-produto-form.component').then(
            (m) => m.AdminProdutoFormComponent
          ),
      },
      {
        path: 'cupons',
        loadComponent: () =>
          import('./features/admin/pages/cupons/admin-cupons.component').then(
            (m) => m.AdminCuponsComponent
          ),
      },
    ],
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
