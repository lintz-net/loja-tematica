import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { obterSupabaseClient } from '../servicos/supabase.client';

export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);

  /** No servidor (prerender) não há sessão de browser pra checar — trata como não
   * autenticado, igual a qualquer visitante sem login. */
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return router.createUrlTree(['/admin/login']);
  }

  const {
    data: { session },
  } = await obterSupabaseClient().auth.getSession();

  if (session) return true;

  return router.createUrlTree(['/admin/login']);
};
