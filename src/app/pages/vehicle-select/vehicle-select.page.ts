import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonSelect, IonSelectOption,
  IonInput, IonButton
} from '@ionic/angular';
import { Router } from '@angular/router';
import { VehicleService, FuelType } from '../../services/vehicle.service';

@Component({
  selector: 'app-vehicle-select',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonSelect, IonSelectOption,
    IonInput, IonButton
  ],
  templateUrl: './vehicle-select.page.html',
})
export class VehicleSelectPage implements OnInit {

  fuelTypes: { value: FuelType; label: string }[] = [
    { value: 'benzina', label: 'Benzina' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'metano', label: 'Metano' },
    { value: 'gpl', label: 'GPL' },
    { value: 'ibrido', label: 'Ibrido' },
  ];

  selectedFuel: FuelType = 'benzina';
  avgConsumption: number = 15; // km/litro di default

  constructor(private vehicleService: VehicleService, private router: Router) {}

  ngOnInit() {
    const existing = this.vehicleService.getProfile();
    if (existing) {
      this.selectedFuel = existing.fuelType;
      this.avgConsumption = existing.avgConsumptionKmL;
    }
  }

  save() {
    this.vehicleService.saveProfile({
      fuelType: this.selectedFuel,
      avgConsumptionKmL: this.avgConsumption,
    });
    this.router.navigateByUrl('/map');
  }
}
