import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'vehicle-select', pathMatch: 'full' },
  {
    path: 'vehicle-select',
    loadComponent: () => import('./pages/vehicle-select/vehicle-select.page').then(m => m.VehicleSelectPage)
  },
  {
    path: 'map',
    loadComponent: () => import('./pages/map/map.page').then(m => m.MapPage)
  },
];