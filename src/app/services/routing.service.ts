import { Injectable } from '@angular/core';

export interface RoutingVehicleProfile {
  fuelType: 'benzina' | 'diesel' | 'metano' | 'gpl' | 'ibrido';
  avgConsumptionKmL: number;
  massKg?: number;
  drivetrainEfficiency?: number;
  fuelEnergyKWhPerUnit?: number;
}

export interface RouteOption {
  geometry: any;           // GeoJSON geometry
  distanceKm: number;
  durationMin: number;
  elevationGainM: number;  // salita totale
  elevationLossM: number;  // discesa totale
  netElevationM: number;   // quota arrivo - quota partenza
  effectiveDistanceKm: number; // distanza equivalente con penalità salite
  estimatedConsumption: number; // litri/kg stimati per QUESTO veicolo
  score: number;           // punteggio combinato (più basso = migliore)
}

@Injectable({ providedIn: 'root' })
export class RoutingService {

  /**
   * Calcola più percorsi alternativi tra due punti usando OSRM,
   * stima il dislivello di ciascuno tramite Open-Elevation,
   * e restituisce le opzioni ordinate dal consumo stimato minore al maggiore.
   */
  async getRouteOptions(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    vehicle: RoutingVehicleProfile
  ): Promise<RouteOption[]> {

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start.lng},${start.lat};${end.lng},${end.lat}` +
      `?overview=full&geometries=geojson&alternatives=true&steps=false`;

    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      return [];
    }

    const routes = data.routes as Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
    if (routes.length < 3) {
      const constrainedAlternatives = await this.getConstrainedAlternatives(start, end, routes);
      routes.push(...constrainedAlternatives);
    }

    const options = await Promise.all(routes.map(async (route): Promise<RouteOption> => {
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;

      const elevation = await this.estimateElevation(route.geometry.coordinates);
      const elevationGainM = elevation.gainM;

      const estimatedConsumption = this.estimateFuelConsumption(
        distanceKm,
        elevationGainM,
        vehicle,
      );
      const effectiveDistanceKm = vehicle.avgConsumptionKmL > 0
        ? estimatedConsumption * vehicle.avgConsumptionKmL
        : distanceKm;

      return {
        geometry: route.geometry,
        distanceKm,
        durationMin,
        elevationGainM,
        elevationLossM: elevation.lossM,
        netElevationM: elevation.netM,
        effectiveDistanceKm,
        estimatedConsumption,
        score: estimatedConsumption, // per ora il punteggio è il consumo stesso
      };
    }));

    // Mantiene i tre percorsi con il consumo stimato più basso.
    options.sort((a, b) => a.score - b.score);
    return options.slice(0, 3);
  }

  private async getConstrainedAlternatives(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    existingRoutes: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>,
  ): Promise<Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>> {
    const bestDistance = Math.min(...existingRoutes.map(route => route.distance));
    const middle = {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    };
    const latitudeOffset = (end.lng - start.lng) * 0.08;
    const longitudeOffset = (end.lat - start.lat) * 0.08;
    const detours = [
      { lat: middle.lat - latitudeOffset, lng: middle.lng + longitudeOffset },
      { lat: middle.lat + latitudeOffset, lng: middle.lng - longitudeOffset },
      { lat: middle.lat - latitudeOffset * 2, lng: middle.lng + longitudeOffset * 2 },
      { lat: middle.lat + latitudeOffset * 2, lng: middle.lng - longitudeOffset * 2 },
    ];
    const candidates = await Promise.all(detours.map(async detour => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${start.lng},${start.lat};${detour.lng},${detour.lat};${end.lng},${end.lat}` +
          `?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const response = await fetch(url);
        const data = await response.json();
        return data.routes?.[0] ?? null;
      } catch {
        return null;
      }
    }));

    const knownGeometries = new Set(existingRoutes.map(route => JSON.stringify(route.geometry)));
    return candidates
      .filter(route => route?.geometry)
      .filter(route => route.distance <= bestDistance * 1.25)
      .filter(route => !knownGeometries.has(JSON.stringify(route.geometry)))
      .filter((route, index, allRoutes) => allRoutes.findIndex(candidate =>
        JSON.stringify(candidate.geometry) === JSON.stringify(route.geometry)) === index)
      .slice(0, Math.max(0, 3 - existingRoutes.length));
  }

  private estimateFuelConsumption(
    distanceKm: number,
    elevationGainM: number,
    vehicle: RoutingVehicleProfile,
  ): number {
    if (vehicle.avgConsumptionKmL <= 0) return 0;

    const baseConsumption = distanceKm / vehicle.avgConsumptionKmL;
    const massKg = vehicle.massKg ?? 1200;
    const efficiency = vehicle.drivetrainEfficiency ?? 0.25;
    const fuelEnergyKWhPerUnit = vehicle.fuelEnergyKWhPerUnit
      ?? this.getFuelEnergyKWhPerUnit(vehicle.fuelType);
    const climbingEnergyKWh = (massKg * 9.81 * elevationGainM) / 3_600_000;
    const climbingConsumption = climbingEnergyKWh / (efficiency * fuelEnergyKWhPerUnit);

    return baseConsumption + climbingConsumption;
  }

  private getFuelEnergyKWhPerUnit(fuelType: RoutingVehicleProfile['fuelType']): number {
    switch (fuelType) {
      case 'metano': return 13.9;
      case 'diesel': return 9.8;
      case 'gpl': return 7.0;
      default: return 8.9;
    }
  }

  /**
   * Campiona il percorso e recupera le quote da Open-Meteo in un'unica richiesta.
   * Restituisce salita, discesa e differenza netta separatamente.
   */
  private async estimateElevation(coordinates: [number, number][]): Promise<{
    gainM: number;
    lossM: number;
    netM: number;
  }> {
    if (coordinates.length < 2) return { gainM: 0, lossM: 0, netM: 0 };

    // Campionamento fitto della geometria per non perdere salite brevi.
    // Open-Meteo accetta le coordinate in un'unica richiesta.
    const maxSamples = 120;
    const sampled: [number, number][] = [];
    const step = Math.max(1, Math.ceil((coordinates.length - 1) / (maxSamples - 1)));
    for (let i = 0; i < coordinates.length; i += step) {
      sampled.push(coordinates[i]);
    }
    if (sampled[sampled.length - 1] !== coordinates[coordinates.length - 1]) {
      sampled.push(coordinates[coordinates.length - 1]);
    }

    try {
      const elevations: number[] = [];
      const chunkSize = 50;

      // Open-Meteo rifiuta URL troppo grandi: i blocchi condividono un punto
      // per mantenere continua la somma tra salita e discesa.
      for (let start = 0; start < sampled.length; start += chunkSize - 1) {
        const chunk = sampled.slice(start, start + chunkSize);
        const latitudes = chunk.map(([, lat]) => lat).join(',');
        const longitudes = chunk.map(([lng]) => lng).join(',');
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
          const res = await fetch(url, { signal: controller.signal });
          const data = await res.json();
          if (!Array.isArray(data.elevation) || data.elevation.length !== chunk.length) {
            return { gainM: 0, lossM: 0, netM: 0 };
          }
          elevations.push(...(start === 0 ? data.elevation : data.elevation.slice(1)));
        } finally {
          clearTimeout(timeout);
        }
      }

      let gain = 0;
      let loss = 0;
      for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 3) gain += diff;
        if (diff < -3) loss += Math.abs(diff);
      }
      return {
        gainM: gain,
        lossM: loss,
        netM: elevations[elevations.length - 1] - elevations[0],
      };
    } catch (err) {
      console.warn('Elevazione non disponibile, uso stima a dislivello zero:', err);
      return { gainM: 0, lossM: 0, netM: 0 };
    }
  }
}
