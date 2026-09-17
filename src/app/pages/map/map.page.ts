import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import * as L from 'leaflet';
import { VehicleService } from '../../services/vehicle.service';

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
  imports: [CommonModule, IonicModule],
  templateUrl: './map.page.html',
})
export class MapPage implements AfterViewInit {

  private map!: L.Map;
  private startPoint: L.LatLng | null = null;
  private endPoint: L.LatLng | null = null;
  private routeLayer: L.Layer | null = null;

  distanceKm: number | null = null;
  estimatedConsumption: number | null = null;

  constructor(private vehicleService: VehicleService) {}

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap() {
    this.map = L.map('map').setView([43.7167, 13.2167], 13); // default: zona Marche

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));

    // Prova a centrare sulla posizione corrente
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.map.setView([pos.coords.latitude, pos.coords.longitude], 14);
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
      this.calculateRoute();
    } else {
      // reset e ricomincia
      this.resetRoute();
      this.startPoint = e.latlng;
      L.marker(this.startPoint).addTo(this.map).bindPopup('Partenza').openPopup();
    }
  }

  private async calculateRoute() {
    if (!this.startPoint || !this.endPoint) return;

    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${this.startPoint.lng},${this.startPoint.lat};${this.endPoint.lng},${this.endPoint.lat}` +
      `?overview=full&geometries=geojson`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        this.distanceKm = route.distance / 1000;
        this.estimatedConsumption = this.vehicleService.estimateConsumption(this.distanceKm);

        if (this.routeLayer) {
          this.map.removeLayer(this.routeLayer);
        }

        this.routeLayer = L.geoJSON(route.geometry, {
          style: { color: '#2dd36f', weight: 5 },
        }).addTo(this.map);

        this.map.fitBounds((this.routeLayer as L.GeoJSON).getBounds());
      }
    } catch (err) {
      console.error('Errore calcolo percorso OSRM:', err);
    }
  }

  resetRoute() {
    this.startPoint = null;
    this.endPoint = null;
    this.distanceKm = null;
    this.estimatedConsumption = null;
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker) this.map.removeLayer(layer);
    });
  }
}
