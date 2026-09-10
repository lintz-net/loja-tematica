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

  if (!session) return router.createUrlTree(['/admin/login']);

  /** Sessão existir não basta — desde que `/conta` (login de cliente) existe, qualquer
   * pessoa pode ter uma sessão autenticada válida sem ser admin. `eh_admin()` (RPC,
   * SECURITY DEFINER) checa a tabela `admins` do lado do banco; ver
   * docs/supabase/migration-010-controle-admin.sql. */
  const { data: souAdmin, error } = await obterSupabaseClient().rpc('eh_admin');
  if (!error && souAdmin === true) return true;

  return router.createUrlTree(['/admin/login']);
};
