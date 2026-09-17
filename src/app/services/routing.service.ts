import { Injectable } from '@angular/core';

export interface RouteOption {
  geometry: any;           // GeoJSON geometry
  distanceKm: number;
  durationMin: number;
  elevationGainM: number;  // dislivello positivo totale
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
    avgConsumptionKmL: number
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

    const options: RouteOption[] = [];

    for (const route of data.routes) {
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;

      const elevationGainM = await this.estimateElevationGain(route.geometry.coordinates);

      // Stima consumo: consumo base sulla distanza + penalità per dislivello.
      // Regola empirica semplificata: ogni 100m di dislivello positivo
      // "costano" come circa 1 km extra di consumo equivalente.
      const equivalentExtraKm = (elevationGainM / 100) * 1;
      const effectiveDistanceKm = distanceKm + equivalentExtraKm;
      const estimatedConsumption = avgConsumptionKmL > 0
        ? effectiveDistanceKm / avgConsumptionKmL
        : 0;

      options.push({
        geometry: route.geometry,
        distanceKm,
        durationMin,
        elevationGainM,
        estimatedConsumption,
        score: estimatedConsumption, // per ora il punteggio è il consumo stesso
      });
    }

    // Ordina dal consumo stimato minore al maggiore
    options.sort((a, b) => a.score - b.score);
    return options;
  }

  /**
   * Campiona i punti del percorso (max 20, per non sovraccaricare l'API gratuita)
   * e chiede l'elevazione a Open-Elevation, poi somma i dislivelli positivi.
   */
  private async estimateElevationGain(coordinates: [number, number][]): Promise<number> {
    if (coordinates.length < 2) return 0;

    // Campiona al massimo 20 punti lungo il percorso
    const maxSamples = 20;
    const step = Math.max(1, Math.floor(coordinates.length / maxSamples));
    const sampled: [number, number][] = [];
    for (let i = 0; i < coordinates.length; i += step) {
      sampled.push(coordinates[i]);
    }

    try {
      const locations = sampled.map(([lng, lat]) => `${lat},${lng}`).join('|');
      const url = `https://api.open-elevation.com/api/v1/lookup?locations=${locations}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.results) return 0;

      let gain = 0;
      for (let i = 1; i < data.results.length; i++) {
        const diff = data.results[i].elevation - data.results[i - 1].elevation;
        if (diff > 0) gain += diff;
      }
      return gain;
    } catch (err) {
      console.warn('Elevazione non disponibile, uso stima a dislivello zero:', err);
      return 0;
    }
  }
}
