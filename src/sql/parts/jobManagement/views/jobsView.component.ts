/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';
import 'vs/css!../common/media/jobs';
import 'vs/css!../common/media/detailview';

import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, AfterContentChecked } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IJobManagementService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vs/nls';
import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import { FieldType, IObservableCollection, CollectionChange, SlickGrid } from 'angular2-slickgrid';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/common/theme/styler';
import { JobHistoryComponent } from './jobHistory.component';
import { AgentViewComponent } from '../agent/agentView.component';
import { RowDetailView } from 'sql/base/browser/ui/table/plugins/rowdetailview';
import { JobCacheObject } from 'sql/parts/jobManagement/common/jobManagementService';


export const JOBSVIEW_SELECTOR: string = 'jobsview-component';

@Component({
	selector: JOBSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobsView.component.html'))
})

export class JobsViewComponent implements AfterContentChecked {

	private _jobManagementService: IJobManagementService;
	private _jobCacheObject: JobCacheObject;

	private _disposables = new Array<vscode.Disposable>();

	private columns: Array<Slick.Column<any>> = [
		{ name: 'Name', field: 'name', formatter: this.renderName, width: 200, },
		{ name: 'Last Run', field: 'lastRun' },
		{ name: 'Next Run', field: 'nextRun' },
		{ name: 'Enabled', field: 'enabled' },
		{ name: 'Status', field: 'currentExecutionStatus' },
		{ name: 'Category', field: 'category' },
		{ name: 'Runnable', field: 'runnable' },
		{ name: 'Schedule', field: 'hasSchedule' },
		{ name: 'Category ID', field: 'categoryId' },
		{ name: 'Last Run Outcome', field: 'lastRunOutcome' },
	];

	private rowDetail: any;
	private dataView: any;

	@ViewChild('jobsgrid') _gridEl: ElementRef;
	private isVisible: boolean = false;
	private isInitialized: boolean = false;
	private _table: Table<any>;
	public jobs: sqlops.AgentJobInfo[];
	public jobHistories: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; } = Object.create(null);
	private _serverName: string;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent
	) {
		this._jobManagementService = bootstrapService.jobManagementService;
		let jobCacheObjectMap = this._jobManagementService.jobCacheObjectMap;
		this._serverName = _dashboardService.connectionManagementService.connectionInfo.connectionProfile.serverName;
		let jobCache = jobCacheObjectMap[this._serverName];
		if (jobCache) {
			this._jobCacheObject = jobCache;
		} else {
			this._jobCacheObject = new JobCacheObject();
			this._jobCacheObject.serverName = this._serverName;
			this._jobManagementService.addToCache(this._serverName, this._jobCacheObject);
		}
	}

	ngAfterContentChecked() {
		if (this.isVisible === false && this._gridEl.nativeElement.offsetParent !== null) {
			this.isVisible = true;
			if (!this.isInitialized) {
				if (this._jobCacheObject.serverName === this._serverName && this._jobCacheObject.jobs.length > 0) {
					this.jobs = this._jobCacheObject.jobs;
					this.onFirstVisible(true);
					this.isInitialized = true;
				} else {
					this.onFirstVisible(false);
					this.isInitialized = true;
				}
			}
		} else if (this.isVisible === true && this._agentViewComponent.refresh === true) {
			this.onFirstVisible(false);
			this._agentViewComponent.refresh = false;
		} else if (this.isVisible === true && this._agentViewComponent.refresh === false) {
			this.onFirstVisible(true);
		} else if (this.isVisible === true && this._gridEl.nativeElement.offsetParent === null) {
			this.isVisible = false;
		}
	}

	onFirstVisible(cached?: boolean) {
		let self = this;
		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		let options = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: 45,
			enableCellNavigation: true
		};

		this.dataView = new Slick.Data.DataView({ inlineFilters: false });
		let rowDetail = new RowDetailView({
			cssClass: 'detailView-toggle',
			preTemplate: this.loadingTemplate,
			process: (job) => {
				(<any>rowDetail).onAsyncResponse.notify({
					'itemDetail': job,
				}, undefined, null);
			},
			panelRows: 2,
			postTemplate: () => ''
		});

		this.rowDetail = rowDetail;

		columns.unshift(this.rowDetail.getColumnDefinition());
		this._table = new Table(this._gridEl.nativeElement, undefined, columns, options);
		this._table.grid.setData(this.dataView, true);
		this._table.grid.onClick.subscribe((e, args) => {
			let job = self.getJob(args);
			self._agentViewComponent.jobId = job.jobId;
			self._agentViewComponent.agentJobInfo = job;
			setTimeout(() => {
				self._agentViewComponent.showHistory = true;
			}, 500);
		});
		if (cached && this._agentViewComponent.refresh !== true) {
			this.onJobsAvailable(this._jobCacheObject.jobs);
		} else {
			let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
			this._jobManagementService.getJobs(ownerUri).then((result) => {
				if (result && result.jobs) {
					self.jobs = result.jobs;
					self._jobCacheObject.jobs = self.jobs;
					self.onJobsAvailable(result.jobs);
				}
			});
		}
	}

	onJobsAvailable(jobs: sqlops.AgentJobInfo[]) {
		let jobViews = jobs.map((job) => {
			return {
				id: job.jobId,
				jobId: job.jobId,
				name: job.name,
				lastRun: job.lastRun,
				nextRun: job.nextRun,
				enabled: job.enabled,
				currentExecutionStatus: job.currentExecutionStatus,
				category: job.category,
				runnable: job.runnable,
				hasSchedule: job.hasSchedule,
				categoryId: job.categoryId,
				lastRunOutcome: job.lastRunOutcome
			};
		});

		this._table.registerPlugin(<any>this.rowDetail);

		this.rowDetail.onBeforeRowDetailToggle.subscribe(function(e, args) {
		});
		this.rowDetail.onAfterRowDetailToggle.subscribe(function(e, args) {
		});
		this.rowDetail.onAsyncEndUpdate.subscribe(function(e, args) {
		});

		this.dataView.beginUpdate();
		this.dataView.setItems(jobViews);
		this.dataView.endUpdate();

		this._table.resizeCanvas();
		this._table.autosizeColumns();
		this.loadJobHistories();
	}

	loadingTemplate() {
		return '<div class="preload">Loading...</div>';
	}

	renderName(row, cell, value, columnDef, dataContext) {
		return '<table class="jobview-jobnametable"><tr class="jobview-jobnamerow">' +
			'<td nowrap class="jobview-jobnameindicatorsuccess"></td>' +
			'<td nowrap class="jobview-jobnametext">' + dataContext.name + '</td>' +
			'</tr></table>';
	}

	loadJobHistories() {
		if (this.jobs) {
			this.jobs.forEach((job) => {
				let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
				this._jobManagementService.getJobHistory(ownerUri, job.jobId).then((result) => {
					if (result.jobs) {
						this.jobHistories[job.jobId] = result.jobs;
						this._jobCacheObject.setJobHistory(job.jobId, result.jobs);
					}
				});
			});
		}
	}

	private getJob(args: Slick.OnClickEventArgs<any>): sqlops.AgentJobInfo {
		let row = args.row;
		let jobName = args.grid.getCellNode(row, 1).innerText.trim();
		let job = this.jobs.filter(job => job.name === jobName)[0];
		return job;
	}
}