import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonBadge, IonSpinner
} from '@ionic/angular';
import * as L from 'leaflet';
import { VehicleService } from '../../services/vehicle.service';
import { RoutingService, RouteOption } from '../../services/routing.service';

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
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonBadge, IonSpinner
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
  loading: boolean = false;

  constructor(
    private vehicleService: VehicleService,
    private routingService: RoutingService
  ) {}

  ngAfterViewInit() {
    this.initMap();
    const profile = this.vehicleService.getProfile();
    this.vehicleLabel = profile?.label ?? 'Nessun veicolo impostato';
  }

  private initMap() {
    this.map = L.map('map').setView([43.7167, 13.2167], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));

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
      L.marker(this.startPoint).addTo(this.map).bindPopup('Partenza').openPopup();
    } else if (!this.endPoint) {
      this.endPoint = e.latlng;
      L.marker(this.endPoint).addTo(this.map).bindPopup('Arrivo').openPopup();
      this.calculateRoutes();
    } else {
      this.resetRoute();
      this.startPoint = e.latlng;
      L.marker(this.startPoint).addTo(this.map).bindPopup('Partenza').openPopup();
    }
  }

  private async calculateRoutes() {
    if (!this.startPoint || !this.endPoint) return;

    this.loading = true;
    this.routeOptions = [];

    const profile = this.vehicleService.getProfile();
    const avgConsumption = profile?.avgConsumptionKmL ?? 15;

    try {
      const options = await this.routingService.getRouteOptions(
        { lat: this.startPoint.lat, lng: this.startPoint.lng },
        { lat: this.endPoint.lat, lng: this.endPoint.lng },
        avgConsumption
      );

      this.routeOptions = options;
      this.selectedIndex = 0; // il primo è già il migliore (ordinati per consumo)
      this.drawRoutes();
    } catch (err) {
      console.error('Errore calcolo percorsi:', err);
    } finally {
      this.loading = false;
    }
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

  resetRoute() {
    this.startPoint = null;
    this.endPoint = null;
    this.routeOptions = [];
    this.routeLayers.forEach(layer => this.map.removeLayer(layer));
    this.routeLayers = [];
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker) this.map.removeLayer(layer);
    });
  }
}
