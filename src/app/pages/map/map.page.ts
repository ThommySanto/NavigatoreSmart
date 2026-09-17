import { ChangeDetectorRef, Component, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonBadge, IonSpinner, IonInput, IonList, IonItem, IonLabel
} from '@ionic/angular';
import * as L from 'leaflet';
import { VehicleService } from '../../services/vehicle.service';
import { RoutingService, RouteOption } from '../../services/routing.service';

interface PlaceSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

// Fix icone default Leaflet in ambiente bundler
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonBadge, IonSpinner, IonInput, IonList, IonItem, IonLabel
  ],
  templateUrl: './map.page.html',
})
export class MapPage implements AfterViewInit {

  private map!: L.Map;
  private startPoint: L.LatLng | null = null;
  private endPoint: L.LatLng | null = null;
  private routeLayers: L.Layer[] = [];

  vehicleLabel: string = '';
  routeOptions: RouteOption[] = [];
  selectedIndex: number = 0;
  recommendedIndex: number = 0;
  consumptionUnit: 'L' | 'kg' = 'L';
  loading: boolean = false;
  startQuery: string = '';
  endQuery: string = '';
  startSuggestions: PlaceSuggestion[] = [];
  endSuggestions: PlaceSuggestion[] = [];
  activeStartSuggestion = -1;
  activeEndSuggestion = -1;
  startSearchMessage = '';
  endSearchMessage = '';

  private startMarker: L.Marker | null = null;
  private endMarker: L.Marker | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;

  constructor(
    private vehicleService: VehicleService,
    private routingService: RoutingService,
    private zone: NgZone,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngAfterViewInit() {
    this.initMap();
    const profile = this.vehicleService.getProfile();
    this.vehicleLabel = profile?.label ?? 'Nessun veicolo impostato';
    this.consumptionUnit = profile?.fuelType === 'metano' ? 'kg' : 'L';
  }

  private initMap() {
    this.map = L.map('map').setView([43.7167, 13.2167], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => this.onMapClick(e));
    });

    setTimeout(() => this.map.invalidateSize(), 300);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        setTimeout(() => this.map.invalidateSize(), 100);
      });
    }
  }

  private onMapClick(e: L.LeafletMouseEvent) {
    if (!this.startPoint) {
      this.startPoint = e.latlng;
      this.startQuery = 'Punto scelto sulla mappa';
      L.marker(this.startPoint).addTo(this.map).bindPopup('Partenza').openPopup();
    } else if (!this.endPoint) {
      this.endPoint = e.latlng;
      this.endQuery = 'Punto scelto sulla mappa';
      L.marker(this.endPoint).addTo(this.map).bindPopup('Arrivo').openPopup();
      this.calculateRoutes();
    } else {
      this.resetRoute();
      this.startPoint = e.latlng;
      this.startQuery = 'Punto scelto sulla mappa';
      L.marker(this.startPoint).addTo(this.map).bindPopup('Partenza').openPopup();
    }
  }

  onPlaceInput(event: CustomEvent, field: 'start' | 'end') {
    const query = String(event.detail.value ?? '');
    if (field === 'start') {
      this.startQuery = query;
      this.startSuggestions = [];
      this.activeStartSuggestion = -1;
      this.startSearchMessage = query.trim().length >= 3 ? 'Ricerca indirizzo...' : '';
    } else {
      this.endQuery = query;
      this.endSuggestions = [];
      this.activeEndSuggestion = -1;
      this.endSearchMessage = query.trim().length >= 3 ? 'Ricerca indirizzo...' : '';
    }

    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (query.trim().length < 3) return;

    this.searchTimer = setTimeout(() => this.searchPlaces(query, field), 300);
  }

  private async searchPlaces(query: string, field: 'start' | 'end') {
    const requestId = ++this.searchRequestId;
    const parts = query.trim().split(/\s+/);
    const streetIndex = parts.findIndex(part => /^(via|viale|piazza|corso|strada|contrada)$/i.test(part));

    try {
      let bbox: string | undefined;
      if (streetIndex > 0) {
        const localityQuery = parts.slice(0, streetIndex).join(' ');
        const localityFeatures = await this.fetchPhotonFeatures(localityQuery, 1);
        const locality = localityFeatures[0]?.geometry?.coordinates;
        if (locality && locality.length >= 2) {
          const [longitude, latitude] = locality;
          bbox = [longitude - 0.08, latitude - 0.06, longitude + 0.08, latitude + 0.06].join(',');
        }
      }

      const queries = streetIndex > 0
        ? [query, [...parts.slice(streetIndex), ...parts.slice(0, streetIndex)].join(' ')]
        : [query];
      const responses = await Promise.all(queries.map(searchQuery =>
        this.fetchPhotonFeatures(searchQuery, 8, bbox),
      ));
      if (requestId !== this.searchRequestId) return;
      const suggestions = responses.flat()
        .map(feature => this.toPlaceSuggestion(feature))
        .filter((place): place is PlaceSuggestion => place !== null)
        .filter((place, index, places) =>
        places.findIndex(candidate => candidate.lat === place.lat && candidate.lon === place.lon) === index,
        ).slice(0, 8);

      if (field === 'start') this.startSuggestions = suggestions;
      else this.endSuggestions = suggestions;
      if (field === 'start') this.activeStartSuggestion = suggestions.length ? 0 : -1;
      else this.activeEndSuggestion = suggestions.length ? 0 : -1;
      if (field === 'start') {
        this.startSearchMessage = suggestions.length ? '' : 'Nessun indirizzo trovato in questa zona';
      } else {
        this.endSearchMessage = suggestions.length ? '' : 'Nessun indirizzo trovato in questa zona';
      }
      this.changeDetector.detectChanges();
    } catch (error) {
      console.warn('Ricerca localita non disponibile:', error);
      if (field === 'start') this.startSearchMessage = 'Ricerca temporaneamente non disponibile';
      else this.endSearchMessage = 'Ricerca temporaneamente non disponibile';
    }
  }

  private async fetchPhotonFeatures(
    query: string,
    limit: number,
    bbox?: string,
  ): Promise<PhotonFeature[]> {
    const params = new URLSearchParams({ limit: String(limit), q: query });
    if (bbox) params.set('bbox', bbox);
    const response = await fetch(`https://photon.komoot.io/api/?${params}`);
    const data = await response.json();
    return data.features ?? [];
  }

  private toPlaceSuggestion(feature: PhotonFeature): PlaceSuggestion | null {
    const coordinates = feature.geometry?.coordinates;
    const properties = feature.properties ?? {};
    if (!coordinates || coordinates.length < 2) return null;

    const addressParts = [
      [properties['street'], properties['housenumber']].filter(Boolean).join(' '),
      properties['city'] ?? properties['town'] ?? properties['village'],
      properties['state'],
      properties['country'],
    ].filter(Boolean);

    return {
      display_name: addressParts.join(', ') || properties['name'] || 'Localita selezionata',
      lat: String(coordinates[1]),
      lon: String(coordinates[0]),
    };
  }

  onSearchKeydown(event: KeyboardEvent, field: 'start' | 'end') {
    const suggestions = field === 'start' ? this.startSuggestions : this.endSuggestions;
    if (!suggestions.length) return;

    const currentIndex = field === 'start'
      ? this.activeStartSuggestion
      : this.activeEndSuggestion;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + suggestions.length) % suggestions.length;
      if (field === 'start') this.activeStartSuggestion = nextIndex;
      else this.activeEndSuggestion = nextIndex;
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (field === 'start') this.startSuggestions = [];
      else this.endSuggestions = [];
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const suggestion = suggestions[currentIndex >= 0 ? currentIndex : 0];
      this.selectSuggestion(suggestion, field);
    }
  }

  selectFirstSuggestion(field: 'start' | 'end') {
    const activeIndex = field === 'start' ? this.activeStartSuggestion : this.activeEndSuggestion;
    const suggestion = field === 'start'
      ? this.startSuggestions[activeIndex >= 0 ? activeIndex : 0]
      : this.endSuggestions[activeIndex >= 0 ? activeIndex : 0];
    if (suggestion) this.selectSuggestion(suggestion, field);
  }

  selectSuggestion(suggestion: PlaceSuggestion, field: 'start' | 'end') {
    const point = L.latLng(Number(suggestion.lat), Number(suggestion.lon));
    this.clearCalculatedRoutes();

    if (field === 'start') {
      this.startPoint = point;
      this.startQuery = suggestion.display_name;
      this.startSuggestions = [];
      this.activeStartSuggestion = -1;
      this.startSearchMessage = '';
      this.startMarker?.remove();
      this.startMarker = L.marker(point).addTo(this.map).bindPopup('Partenza');
    } else {
      this.endPoint = point;
      this.endQuery = suggestion.display_name;
      this.endSuggestions = [];
      this.activeEndSuggestion = -1;
      this.endSearchMessage = '';
      this.endMarker?.remove();
      this.endMarker = L.marker(point).addTo(this.map).bindPopup('Arrivo');
    }

    if (this.startPoint && this.endPoint) this.calculateRoutes();
  }

  private async calculateRoutes() {
    if (!this.startPoint || !this.endPoint) return;

    this.loading = true;
    this.routeOptions = [];

    const profile = this.vehicleService.getProfile();
    const vehicle = profile ?? {
      fuelType: 'benzina' as const,
      avgConsumptionKmL: 15,
    };

    try {
      const options = await this.routingService.getRouteOptions(
        { lat: this.startPoint.lat, lng: this.startPoint.lng },
        { lat: this.endPoint.lat, lng: this.endPoint.lng },
        vehicle
      );

      this.routeOptions = options;
      this.recommendedIndex = this.getMostEconomicalRouteIndex(options);
      this.selectedIndex = this.recommendedIndex;
      this.changeDetector.detectChanges();
      this.drawRoutes();
    } catch (err) {
      console.error('Errore calcolo percorsi:', err);
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private getMostEconomicalRouteIndex(options: RouteOption[]): number {
    if (options.length === 0) return 0;

    return options.reduce(
      (bestIndex, option, index) => option.estimatedConsumption < options[bestIndex].estimatedConsumption
        ? index
        : bestIndex,
      0,
    );
  }

  private drawRoutes() {
    // Rimuovi layer precedenti
    this.routeLayers.forEach(layer => this.map.removeLayer(layer));
    this.routeLayers = [];

    this.routeOptions.forEach((option, index) => {
      const isBest = index === this.selectedIndex;
      const layer = L.geoJSON(option.geometry, {
        style: {
          color: isBest ? '#2dd36f' : '#a0a0a0',
          weight: isBest ? 6 : 3,
          opacity: isBest ? 1 : 0.5,
          dashArray: isBest ? undefined : '6 6',
        },
      }).addTo(this.map);

      layer.on('click', () => this.selectRoute(index));
      this.routeLayers.push(layer);
    });

    if (this.routeLayers.length > 0) {
      const group = L.featureGroup(this.routeLayers as L.Layer[]);
      this.map.fitBounds(group.getBounds());
    }
  }

  selectRoute(index: number) {
    this.selectedIndex = index;
    this.drawRoutes();
  }

  private clearCalculatedRoutes() {
    this.routeOptions = [];
    this.recommendedIndex = 0;
    this.selectedIndex = 0;
    this.routeLayers.forEach(layer => this.map.removeLayer(layer));
    this.routeLayers = [];
  }

  resetRoute() {
    this.startPoint = null;
    this.endPoint = null;
    this.startQuery = '';
    this.endQuery = '';
    this.startSuggestions = [];
    this.endSuggestions = [];
    this.activeStartSuggestion = -1;
    this.activeEndSuggestion = -1;
    this.startSearchMessage = '';
    this.endSearchMessage = '';
    this.clearCalculatedRoutes();
    this.startMarker = null;
    this.endMarker = null;
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker) this.map.removeLayer(layer);
    });
  }
}
