/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* tslint:disable:no-empty */

import {Component, Input, OnInit} from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';

import { UserResourceService } from '../../core/services';

import { ExploratoryModel, Exploratory } from './resources-grid.model';
import { FilterConfigurationModel } from './filter-configuration.model';
import { GeneralEnvironmentStatus } from '../../administration/management/management.model';
import { ConfirmationDialogType } from '../../shared';
import { SortUtils, CheckUtils } from '../../core/util';
import { DetailDialogComponent } from '../exploratory/detail-dialog';
import { AmiCreateDialogComponent } from '../exploratory/ami-create-dialog';
import { InstallLibrariesComponent } from '../exploratory/install-libraries';
import { ComputationalResourceCreateDialogComponent } from '../computational/computational-resource-create-dialog/computational-resource-create-dialog.component';
import { CostDetailsDialogComponent } from '../exploratory/cost-details-dialog';
import { ConfirmationDialogComponent } from '../../shared/modal-dialog/confirmation-dialog';
import { SchedulerComponent } from '../scheduler';

import { DICTIONARY } from '../../../dictionary/global.dictionary';
import {ProgressBarService} from '../../core/services/progress-bar.service';
import {ComputationModel} from '../computational/computational-resource.model';
import {NotebookModel} from '../exploratory/notebook.model';





@Component({
  selector: 'resources-grid',
  templateUrl: 'resources-grid.component.html',
  styleUrls: ['./resources-grid.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})

export class ResourcesGridComponent implements OnInit {
  readonly DICTIONARY = DICTIONARY;

  @Input() projects: Array<any>;

  environments: Exploratory[];

  collapseFilterRow: boolean = false;
  filtering: boolean = false;
  activeFiltering: boolean = false;
  activeProject: any;
  healthStatus: GeneralEnvironmentStatus;

  filteredEnvironments: Exploratory[] = [];
  filterConfiguration: FilterConfigurationModel = new FilterConfigurationModel('', [], [], [], '', '');
  filterForm: FilterConfigurationModel = new FilterConfigurationModel('', [], [], [], '', '');

  public filteringColumns: Array<any> = [
    { title: 'Environment name', name: 'name', class: 'name-col', filter_class: 'name-filter', filtering: true },
    { title: 'Status', name: 'statuses', class: 'status-col', filter_class: 'status-filter', filtering: true },
    { title: 'Instance size', name: 'shapes', class: 'shape-col', filter_class: 'shape-filter', filtering: true },
    { title: 'Tags', name: 'tag', class: 'tag-col', filter_class: 'tag-filter', filtering: false },
    { title: 'Computational resource', name: 'resources', class: 'resources-col', filter_class: 'resource-filter', filtering: true },
    { title: 'Cost', name: 'cost', class: 'cost-col', filter_class: 'cost-filter', filtering: false },
    { title: '', name: 'actions', class: 'actions-col', filter_class: 'action-filter', filtering: false }
  ];

  public displayedColumns: string[] = this.filteringColumns.map(item => item.name);
  public displayedFilterColumns: string[] = this.filteringColumns.map(item => item.filter_class);


  constructor(
    public toastr: ToastrService,
    private userResourceService: UserResourceService,
    private dialog: MatDialog,
    private progressBarService: ProgressBarService,
  ) { }

  ngOnInit(): void {
    this.buildGrid();
  }

  public buildGrid(): void {
    setTimeout(() => {this.progressBarService.startProgressBar(); } , 0);
    this.userResourceService.getUserProvisionedResources()
      .subscribe((result: any) => {
        this.environments = ExploratoryModel.loadEnvironments(result);
        this.getDefaultFilterConfiguration();
        (this.environments.length) ? this.getUserPreferences() : this.filteredEnvironments = [];
        this.healthStatus && !this.healthStatus.billingEnabled && this.modifyGrid();
        this.progressBarService.stopProgressBar();
      }, () => this.progressBarService.stopProgressBar());
  }

  public toggleFilterRow(): void {
    this.collapseFilterRow = !this.collapseFilterRow;
  }

  public onUpdate($event) {
    this.filterForm[$event.type] = $event.model;
  }

  public selectActiveProject(project = '') {
    this.filterForm.project = project;
    this.applyFilter_btnClick(this.filterForm);
  }

  public showActiveInstances(): void {
    this.filterForm = this.loadUserPreferences(this.filterActiveInstances());
    this.applyFilter_btnClick(this.filterForm);
    this.buildGrid();
  }

  public containsNotebook(notebook_name: string, envoirmentNames: Array<string>): boolean {
    if (notebook_name && envoirmentNames.length ) {
        return envoirmentNames
          .some(item => CheckUtils.delimitersFiltering(notebook_name) === CheckUtils.delimitersFiltering(item));
      }
      return false;
   }


  public isResourcesInProgress(notebook) {
    const env = this.getResourceByName(notebook.name, notebook.project);

    if (env && env.resources.length) {
      return env.resources.filter(item => (item.status !== 'failed' && item.status !== 'terminated'
        && item.status !== 'running' && item.status !== 'stopped')).length > 0;
    }
    return false;
  }

  public filterActiveInstances(): FilterConfigurationModel {
    return (<FilterConfigurationModel | any>Object).assign({}, this.filterConfiguration, {
      statuses: SortUtils.activeStatuses(),
      resources: SortUtils.activeStatuses(),
      type: 'active',
      project: this.activeProject || ''
    });
  }

  public resetFilterConfigurations(): void {
    this.filterForm.resetConfigurations();
    this.updateUserPreferences(this.filterForm);
    this.buildGrid();
  }

  public printDetailEnvironmentModal(data): void {
    this.dialog.open(DetailDialogComponent, { data: data, panelClass: 'modal-lg' })
      .afterClosed().subscribe(() => this.buildGrid());
  }

  public printCostDetails(data): void {
    this.dialog.open(CostDetailsDialogComponent, { data: data, panelClass: 'modal-xl' })
      .afterClosed().subscribe(() => this.buildGrid());
  }

  public exploratoryAction(data, action: string) {
    const resource = this.getResourceByName(data.name, data.project);

    if (action === 'deploy') {
      this.dialog.open(ComputationalResourceCreateDialogComponent, { data: { notebook: resource, full_list: this.environments }, panelClass: 'modal-xxl' })
        .afterClosed().subscribe(() => this.buildGrid());
    } else if (action === 'run') {
      this.userResourceService
        .runExploratoryEnvironment({ notebook_instance_name: data.name, project_name: data.project })
        .subscribe(
          () => this.buildGrid(),
          error => this.toastr.error(error.message || 'Exploratory starting failed!', 'Oops!'));
    } else if (action === 'stop') {
      this.dialog.open(ConfirmationDialogComponent, { data: { notebook: data, type: ConfirmationDialogType.StopExploratory }, panelClass: 'modal-sm' })
        .afterClosed().subscribe(() => this.buildGrid());
    } else if (action === 'terminate') {
      this.dialog.open(ConfirmationDialogComponent, { data:
          { notebook: data, type: ConfirmationDialogType.TerminateExploratory }, panelClass: 'modal-sm' })
        .afterClosed().subscribe(() => this.buildGrid());
    } else if (action === 'install') {
      this.dialog.open(InstallLibrariesComponent, { data: data, panelClass: 'modal-fullscreen' })
        .afterClosed().subscribe(() => this.buildGrid());
    } else if (action === 'schedule') {
      this.dialog.open(SchedulerComponent, { data: { notebook: data, type: 'EXPLORATORY' }, panelClass: 'modal-xl-s' })
        .afterClosed().subscribe(() => this.buildGrid());
    } else if (action === 'ami') {
      this.dialog.open(AmiCreateDialogComponent, { data: data, panelClass: 'modal-sm' })

        .afterClosed().subscribe(() => this.buildGrid());
    }
  }


  // PRIVATE
  private getResourceByName(notebook_name: string, project_name: string) {
    return this.getEnvironmentsListCopy().filter(environments => environments.project === project_name)
      .map(env => env.exploratory.find(({ name }) => name === notebook_name))
      .filter(name => !!name)[0];
  }

  private getEnvironmentsListCopy() {
    return this.environments.map(env => JSON.parse(JSON.stringify(env)));
  }

  private getDefaultFilterConfiguration(): void {
    const data: Exploratory[] = this.environments;
    const shapes = [], statuses = [], resources = [];

    data.filter(elem => elem.exploratory.map((item: any) => {
      if (shapes.indexOf(item.shape) === -1) shapes.push(item.shape);
      if (statuses.indexOf(item.status) === -1) statuses.push(item.status);
      statuses.sort(SortUtils.statusSort);

      item.resources.map((resource: any) => {
        if (resources.indexOf(resource.status) === -1) resources.push(resource.status);
        resources.sort(SortUtils.statusSort);
      });
    }));

    this.filterConfiguration = new FilterConfigurationModel('', statuses, shapes, resources, '', '');
  }

  private applyFilter_btnClick(config: FilterConfigurationModel) {

    let filteredData = this.getEnvironmentsListCopy();

    const containsStatus = (list, selectedItems) => {
      return list.filter((item: any) => { if (selectedItems.indexOf(item.status) !== -1) return item; });
    };

    if (filteredData.length) this.filtering = true;
    if (config) {
      this.activeProject = config.project;
      filteredData = filteredData
        .filter(project => config.project ? project.project === config.project : project)
        .filter(project => {

          project.exploratory = project.exploratory.filter(item => {

            const isName = item.name.toLowerCase().indexOf(config.name.toLowerCase()) !== -1;
            const isStatus = config.statuses.length > 0 ? (config.statuses.indexOf(item.status) !== -1) : (config.type !== 'active');
            const isShape = config.shapes.length > 0 ? (config.shapes.indexOf(item.shape) !== -1) : true;

            const modifiedResources = containsStatus(item.resources, config.resources);
            let isResources = config.resources.length > 0 ? (modifiedResources.length > 0) : true;

            if (config.resources.length > 0 && modifiedResources.length > 0) { item.resources = modifiedResources; }

            if (config.resources.length === 0 && config.type === 'active' ||
              modifiedResources.length >= 0 && config.resources.length > 0 && config.type === 'active') {
              item.resources = modifiedResources;
              isResources = true;
            }

            return isName && isStatus && isShape && isResources;
          });
          return project.exploratory.length > 0;
        });

      this.updateUserPreferences(config);
    }

    let failedNotebooks = NotebookModel.notebook(this.getEnvironmentsListCopy());
    failedNotebooks = SortUtils.flatDeep(failedNotebooks, 1).filter(notebook => notebook.status === 'failed');
    if (this.filteredEnvironments.length && this.activeFiltering) {
      let creatingNotebook = NotebookModel.notebook(this.filteredEnvironments);
      creatingNotebook = SortUtils.flatDeep(creatingNotebook, 1).filter(resourse => resourse.status === 'creating');
      const fail = failedNotebooks
        .filter(v => creatingNotebook
          .some(create => create.project === v.project && create.exploratory === v.exploratory && create.resource === v.resource));
      if (fail.length) {
        this.toastr.error('Creating notebook failed!', 'Oops!');
      }
    }

    let failedResource = ComputationModel.computationRes(this.getEnvironmentsListCopy());
    failedResource = SortUtils.flatDeep(failedResource, 2).filter(resourse => resourse.status === 'failed');
    if (this.filteredEnvironments.length && this.activeFiltering) {
      let creatingResource = ComputationModel.computationRes(this.filteredEnvironments);
      creatingResource = SortUtils.flatDeep(creatingResource, 2).filter(resourse => resourse.status === 'creating');
      const fail = failedResource
        .filter(v => creatingResource
          .some(create => create.project === v.project && create.exploratory === v.exploratory && create.resource === v.resource));
      if (fail.length) {
        this.toastr.error('Creating computation resource failed!', 'Oops!');
      }
    }
    this.filteredEnvironments = filteredData;
  }

  private modifyGrid(): void {
    this.displayedColumns = this.displayedColumns.filter(el => el !== 'cost');
    this.displayedFilterColumns = this.displayedFilterColumns.filter(el => el !== 'cost-filter');
  }

  private aliveStatuses(сonfig): void {
    for (const index in this.filterConfiguration) {
      if (сonfig[index] && сonfig[index] instanceof Array)
        сonfig[index] = сonfig[index].filter(item => this.filterConfiguration[index].includes(item));
    }
    return сonfig;
  }

  isActiveFilter(filterConfig): void {
    this.activeFiltering = false;

    for (const index in filterConfig)
      if (filterConfig[index].length) this.activeFiltering = true;
  }

  private getUserPreferences(): void {
    this.userResourceService.getUserPreferences()
      .subscribe((result: FilterConfigurationModel) => {
        if (result) {
          this.isActiveFilter(result);
          this.filterForm = this.loadUserPreferences(result.type ? this.filterActiveInstances() : this.aliveStatuses(result));
        }
        this.applyFilter_btnClick(result || this.filterForm);
      }, () => this.applyFilter_btnClick(null));
  }

  private loadUserPreferences(config): FilterConfigurationModel {
    return new FilterConfigurationModel(config.name, config.statuses, config.shapes, config.resources, config.type, config.project);
  }

  private updateUserPreferences(filterConfiguration: FilterConfigurationModel): void {
    this.userResourceService.updateUserPreferences(filterConfiguration)
      .subscribe((result) => { },
        (error) => console.log('UPDATE USER PREFERENCES ERROR ', error));
  }
}
