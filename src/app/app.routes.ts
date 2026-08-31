import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login').then((m) => m.default),
  },
  /*
  {
    path: 'planos',
    loadComponent: () =>
      import('./planos/planos').then((m) => m.default),
  },
  */
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('@home/pages/home/home').then((m) => m.default),
      },
      {
        path: 'agenda',
        loadComponent: () =>
          import('@agenda/pages/agenda/agenda').then((m) => m.default),
      },
      {
        path: 'contato',
        loadComponent: () =>
          import('@contato/pages/contato/contato').then((m) => m.default),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./admin/admin').then((m) => m.default),
      },
      { path: '**', redirectTo: 'home' },
    ],
  },
];
