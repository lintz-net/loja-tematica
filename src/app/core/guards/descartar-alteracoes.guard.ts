import { CanDeactivateFn } from '@angular/router';

export interface ComponenteComAlteracoesPendentes {
  sujo(): boolean;
}

/** Confirma antes de sair de um formulário com alterações não salvas — usado no cadastro/
 * edição de produto, cujo formulário grande (imagens, variantes, medidas) é fácil de perder
 * sem querer ao clicar em "Voltar" ou navegar pra outro lugar. */
export const descartarAlteracoesGuard: CanDeactivateFn<ComponenteComAlteracoesPendentes> = (
  componente
) => {
  if (!componente.sujo()) return true;
  return window.confirm('Você tem alterações não salvas. Deseja realmente sair sem salvar?');
};
