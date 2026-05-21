import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'records-test', loadComponent: () => import('./features/records-test/records-test.component').then(m => m.RecordsTestComponent) },
      { path: 'profile',   loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];

