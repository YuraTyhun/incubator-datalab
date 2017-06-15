/***************************************************************************

Copyright (c) 2016, EPAM SYSTEMS INC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

****************************************************************************/

import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ReportingFilterConfigurationModel } from '../reporting-data.model';

@Component({
  selector: 'dlab-reporting-grid',
  templateUrl: './reporting-grid.component.html',
  styleUrls: ['./reporting-grid.component.css',
              '../../resources/resources-grid/resources-grid.component.css']
})
export class ReportingGridComponent implements OnInit {

  filterConfiguration: ReportingFilterConfigurationModel;
  filteredReportData: ReportingFilterConfigurationModel = new ReportingFilterConfigurationModel([], [], [], [], '', '');
  collapseFilterRow: boolean = false;
  reportData: ReportingFilterConfigurationModel[];

  @Output() filterReport: EventEmitter<{}> = new EventEmitter();

  constructor() { }

  public filteringColumns: Array<any> = [
    { title: 'User', name: 'user', className: 'th_user', filtering: {}, role: 'admin'},
    { title: 'Environment name', name: 'name', className: 'th_env_name', filtering: {} },
    { title: 'Resource Type', name: 'type', className: 'th_type', filtering: {} },
    { title: 'Shape', name: 'shape', className: 'th_shape', filtering: {} },
    { title: 'Service', name: 'service', className: 'th_service', filtering: {} },
    { title: 'Service Charges', name: 'charges', className: 'th_charges' },
    // { title: 'Cloud provider', className: 'th_provider' },
    { title: 'Actions', className: 'th_actions' }
  ];

  ngOnInit() {
    console.log(this.reportData);
  }

  onUpdate($event): void {
    this.filteredReportData[$event.type] = $event.model;
    console.log(this.filteredReportData);
  }

  toggleFilterRow(): void {
    this.collapseFilterRow = !this.collapseFilterRow;
  }

  setConfiguration(users, types, shapes, services): void {
    this.filterConfiguration = new ReportingFilterConfigurationModel(users, services, types, shapes, '', '' );
    console.log('filterConfiguration: ', this.filterConfiguration);
  }

  filter_btnClick(clearing?: string): void {
    if (clearing) this.filteredReportData.defaultConfigurations();

    this.filterReport.emit(this.filteredReportData);
  }
}
