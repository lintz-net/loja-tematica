import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfiguracaoLojaService } from '../../core/servicos/configuracao-loja.service';

export interface Passo {
  titulo: string;
  texto: string;
}

/** Ícone ilustrativo ao lado do título da seção — só os usados hoje (política de
 * privacidade); adicionar mais conforme necessário em `pagina-institucional.component.html`. */
export type IconeSecao =
  | 'cadeado'
  | 'escudo'
  | 'base-dados'
  | 'compartilhar'
  | 'cookie'
  | 'email'
  | 'coracao'
  | 'estrela';

export interface SecaoInstitucional {
  titulo?: string;
  icone?: IconeSecao;
  paragrafos?: string[];
  lista?: string[];
  passos?: Passo[];
}

export interface DadosPaginaInstitucional {
  titulo: string;
  /** Selo pequeno acima do título (ex.: "Atualizado em..."), pro visual de página de
   * verdade em vez de rascunho — usado na política de privacidade. */
  selo?: string;
  paragrafos?: string[];
  secoes?: SecaoInstitucional[];
  passos?: Passo[];
  nota?: string;
}

@Component({
  selector: 'app-pagina-institucional',
  standalone: true,
  templateUrl: './pagina-institucional.component.html',
  styleUrl: './pagina-institucional.component.scss',
})
export class PaginaInstitucionalComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly configuracaoLojaService = inject(ConfiguracaoLojaService);

  readonly dados = this.substituirPlaceholders(
    this.route.snapshot.data['pagina'] as DadosPaginaInstitucional
  );

  /** Troca {{nomeLoja}}/{{emailContato}} pelos valores reais — ver comentário em
   * `app.routes.ts` sobre por que esses textos usam placeholder em vez de vir do banco
   * inteiros. Resolvido de forma síncrona porque `ConfiguracaoLojaService` já foi carregado
   * pelo `APP_INITIALIZER` antes de qualquer componente rodar. */
  private substituirPlaceholders(dados: DadosPaginaInstitucional): DadosPaginaInstitucional {
    const configuracao = this.configuracaoLojaService.configuracao();
    const valores: Record<string, string> = {
      nomeLoja: configuracao?.nomeLoja ?? '',
      emailContato: configuracao?.emailContato ?? '',
    };
    const resolver = (texto: string): string =>
      texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave] ?? '');

    const resolverPassos = (passos?: Passo[]): Passo[] | undefined =>
      passos?.map((passo) => ({ titulo: resolver(passo.titulo), texto: resolver(passo.texto) }));

    return {
      ...dados,
      titulo: resolver(dados.titulo),
      selo: dados.selo ? resolver(dados.selo) : dados.selo,
      nota: dados.nota ? resolver(dados.nota) : dados.nota,
      paragrafos: dados.paragrafos?.map(resolver),
      passos: resolverPassos(dados.passos),
      secoes: dados.secoes?.map((secao) => ({
        ...secao,
        titulo: secao.titulo ? resolver(secao.titulo) : secao.titulo,
        paragrafos: secao.paragrafos?.map(resolver),
        lista: secao.lista?.map(resolver),
        passos: resolverPassos(secao.passos),
      })),
    };
  }
}
