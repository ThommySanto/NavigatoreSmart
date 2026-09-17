import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonSelect, IonSelectOption,
  IonInput, IonButton, IonSegment, IonSegmentButton
} from '@ionic/angular';
import { Router } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { FuelType, getCategories, getModelsByCategory, VehicleModel } from '../../data/vehicle-database';

@Component({
  selector: 'app-vehicle-select',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonSelect, IonSelectOption,
    IonInput, IonButton, IonSegment, IonSegmentButton
  ],
  templateUrl: './vehicle-select.page.html',
})
export class VehicleSelectPage implements OnInit {

  mode: 'database' | 'custom' = 'database';

  categories: string[] = getCategories();
  selectedCategory: string = this.categories[0];
  modelsInCategory: VehicleModel[] = getModelsByCategory(this.selectedCategory);
  selectedVehicleId: string = this.modelsInCategory[0]?.id ?? '';

  customFuel: FuelType = 'benzina';
  customConsumption: number = 15;

  constructor(private vehicleService: VehicleService, private router: Router) {}

  ngOnInit() {
    const existing = this.vehicleService.getProfile();
    if (existing) {
      if (existing.vehicleId) {
        this.mode = 'database';
        this.selectedVehicleId = existing.vehicleId;
      } else {
        this.mode = 'custom';
        this.customFuel = existing.fuelType;
        this.customConsumption = existing.avgConsumptionKmL;
      }
    }
  }

  onCategoryChange() {
    this.modelsInCategory = getModelsByCategory(this.selectedCategory);
    this.selectedVehicleId = this.modelsInCategory[0]?.id ?? '';
  }

  save() {
    if (this.mode === 'database' && this.selectedVehicleId) {
      this.vehicleService.saveProfileFromDatabase(this.selectedVehicleId);
    } else {
      this.vehicleService.saveCustomProfile(this.customFuel, this.customConsumption);
    }
    this.router.navigateByUrl('/map');
  }
}
