import { Injectable } from '@angular/core';
import { FuelType, getModelById } from '../data/vehicle-database';

export interface VehicleProfile {
  vehicleId?: string;      // se selezionato dal database
  fuelType: FuelType;
  avgConsumptionKmL: number;
  label: string;           // nome mostrato all'utente
  massKg?: number;
  drivetrainEfficiency?: number;
  fuelEnergyKWhPerUnit?: number;
}

const STORAGE_KEY = 'ecoroute_vehicle_profile';

@Injectable({ providedIn: 'root' })
export class VehicleService {

  getProfile(): VehicleProfile | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  saveProfileFromDatabase(vehicleId: string): void {
    const model = getModelById(vehicleId);
    if (!model) return;
    const profile: VehicleProfile = {
      vehicleId: model.id,
      fuelType: model.fuelType,
      avgConsumptionKmL: model.avgConsumptionKmL,
      label: model.name,
      massKg: model.massKg,
      drivetrainEfficiency: model.drivetrainEfficiency,
      fuelEnergyKWhPerUnit: model.fuelEnergyKWhPerUnit,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  saveCustomProfile(fuelType: FuelType, avgConsumptionKmL: number): void {
    const profile: VehicleProfile = {
      fuelType,
      avgConsumptionKmL,
      label: 'Veicolo personalizzato',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  // Consumo stimato in litri (o kg per metano) per una distanza data in km
  estimateConsumption(distanceKm: number): number | null {
    const profile = this.getProfile();
    if (!profile || !profile.avgConsumptionKmL) return null;
    return distanceKm / profile.avgConsumptionKmL;
  }
}
