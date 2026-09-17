export type FuelType = 'benzina' | 'diesel' | 'metano' | 'gpl' | 'ibrido';

export interface VehicleModel {
  id: string;
  category: string;      // es. "Utilitaria", "Berlina", "SUV"
  name: string;           // es. "Fiat Panda 1.2"
  fuelType: FuelType;
  avgConsumptionKmL: number; // km per litro (o kg per metano) in condizioni miste
}

// Valori stimati/tipici (dati indicativi da schede tecniche medie, non ufficiali)
export const VEHICLE_DATABASE: VehicleModel[] = [
  // Utilitarie
  { id: 'panda-benzina', category: 'Utilitaria', name: 'Fiat Panda 1.2 Benzina', fuelType: 'benzina', avgConsumptionKmL: 16.5 },
  { id: 'panda-gpl', category: 'Utilitaria', name: 'Fiat Panda 1.2 GPL', fuelType: 'gpl', avgConsumptionKmL: 13.0 },
  { id: 'panda-metano', category: 'Utilitaria', name: 'Fiat Panda 0.9 Metano', fuelType: 'metano', avgConsumptionKmL: 15.0 },
  { id: 'punto-diesel', category: 'Utilitaria', name: 'Fiat Punto 1.3 Multijet', fuelType: 'diesel', avgConsumptionKmL: 20.0 },
  { id: 'yaris-ibrido', category: 'Utilitaria', name: 'Toyota Yaris Hybrid', fuelType: 'ibrido', avgConsumptionKmL: 22.0 },

  // Berline/Compatte
  { id: 'golf-benzina', category: 'Berlina', name: 'VW Golf 1.5 TSI', fuelType: 'benzina', avgConsumptionKmL: 15.0 },
  { id: 'golf-diesel', category: 'Berlina', name: 'VW Golf 2.0 TDI', fuelType: 'diesel', avgConsumptionKmL: 19.5 },
  { id: 'octavia-gpl', category: 'Berlina', name: 'Skoda Octavia 1.5 TSI GPL', fuelType: 'gpl', avgConsumptionKmL: 11.5 },
  { id: 'corolla-ibrido', category: 'Berlina', name: 'Toyota Corolla Hybrid', fuelType: 'ibrido', avgConsumptionKmL: 21.0 },

  // SUV/Crossover
  { id: 'suv-benzina', category: 'SUV', name: 'SUV compatto 1.5 Benzina', fuelType: 'benzina', avgConsumptionKmL: 12.5 },
  { id: 'suv-diesel', category: 'SUV', name: 'SUV compatto 2.0 Diesel', fuelType: 'diesel', avgConsumptionKmL: 16.0 },
  { id: 'suv-ibrido', category: 'SUV', name: 'SUV Hybrid', fuelType: 'ibrido', avgConsumptionKmL: 18.0 },

  // Furgoni/Van
  { id: 'van-diesel', category: 'Van/Furgone', name: 'Furgone commerciale Diesel', fuelType: 'diesel', avgConsumptionKmL: 11.0 },
];

export function getCategories(): string[] {
  return [...new Set(VEHICLE_DATABASE.map(v => v.category))];
}

export function getModelsByCategory(category: string): VehicleModel[] {
  return VEHICLE_DATABASE.filter(v => v.category === category);
}

export function getModelById(id: string): VehicleModel | undefined {
  return VEHICLE_DATABASE.find(v => v.id === id);
}
