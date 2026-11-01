import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

// Paths are relative to /admin. Every page is lazy-loaded.
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Connexion',
    loadComponent: () => import('./login/admin-login.page').then((m) => m.AdminLoginPage),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('../../layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Tableau de bord',
        loadComponent: () => import('./dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'orders',
        title: 'Commandes',
        loadComponent: () => import('./orders/orders.page').then((m) => m.OrdersPage),
      },
      {
        path: 'products',
        title: 'Produits',
        loadComponent: () => import('./products/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'categories',
        title: 'Catégories',
        loadComponent: () => import('./categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'messages',
        title: 'Messages',
        loadComponent: () => import('./messages/messages.page').then((m) => m.MessagesPage),
      },
      {
        path: 'settings',
        title: 'Paramètres',
        loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'security',
        title: 'Sécurité',
        loadComponent: () => import('./security/security.page').then((m) => m.SecurityPage),
      },
    ],
  },
];
