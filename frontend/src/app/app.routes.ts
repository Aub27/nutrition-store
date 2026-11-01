import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./layout/store-layout.component').then((m) => m.StoreLayoutComponent),
    children: [
      { path: '', title: 'Accueil', loadComponent: () => import('./pages/store/home.page').then((m) => m.HomePage) },
      { path: 'boutique', title: 'Boutique', loadComponent: () => import('./pages/store/shop.page').then((m) => m.ShopPage) },
      { path: 'produit/:slug', loadComponent: () => import('./pages/store/product.page').then((m) => m.ProductPage) },
      { path: 'panier', title: 'Panier', loadComponent: () => import('./pages/store/cart.page').then((m) => m.CartPage) },
      { path: 'commande', title: 'Commande', loadComponent: () => import('./pages/store/checkout.page').then((m) => m.CheckoutPage) },
      {
        path: 'commande/confirmation',
        title: 'Commande confirmée',
        loadComponent: () => import('./pages/store/confirmation.page').then((m) => m.ConfirmationPage),
      },
      { path: 'contact', title: 'Contact', loadComponent: () => import('./pages/store/contact.page').then((m) => m.ContactPage) },
      {
        path: 'confidentialite',
        title: 'Politique de confidentialité',
        loadComponent: () => import('./pages/store/legal.page').then((m) => m.LegalPage),
        data: { doc: 'privacy' },
      },
      {
        path: 'conditions',
        title: 'Conditions générales de vente',
        loadComponent: () => import('./pages/store/legal.page').then((m) => m.LegalPage),
        data: { doc: 'terms' },
      },
      { path: '**', title: 'Page introuvable', loadComponent: () => import('./pages/store/not-found.page').then((m) => m.NotFoundPage) },
    ],
  },
];
