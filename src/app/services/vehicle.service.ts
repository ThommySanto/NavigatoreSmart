import { Injectable } from '@angular/core';

export type FuelType = 'benzina' | 'diesel' | 'metano' | 'gpl' | 'ibrido';

export interface VehicleProfile {
  fuelType: FuelType;
  avgConsumptionKmL: number; // km percorsi con 1 litro (o kg per metano)
}

const STORAGE_KEY = 'ecoroute_vehicle_profile';

@Injectable({ providedIn: 'root' })
export class VehicleService {

  getProfile(): VehicleProfile | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  saveProfile(profile: VehicleProfile): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  // Consumo stimato in litri (o kg per metano) per una distanza data in km
  estimateConsumption(distanceKm: number): number | null {
    const profile = this.getProfile();
    if (!profile || !profile.avgConsumptionKmL) return null;
    return distanceKm / profile.avgConsumptionKmL;
  }
}
