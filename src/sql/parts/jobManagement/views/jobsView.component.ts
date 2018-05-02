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
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!sql/base/browser/ui/table/media/table';

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
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
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
import { AgentJobUtilities } from '../common/agentJobUtilities';
import { HeaderFilter } from '../../../base/browser/ui/table/plugins/headerFilter.plugin';


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
		{ name: nls.localize('jobColumns.name','Name'), field: 'name', formatter: this.renderName, width: 200, id: 'name' },
		{ name: nls.localize('jobColumns.lastRun','Last Run'), field: 'lastRun', minWidth: 150, id: 'lastRun' },
		{ name: nls.localize('jobColumns.nextRun','Next Run'), field: 'nextRun', minWidth: 150, id: 'nextRun' },
		{ name: nls.localize('jobColumns.enabled','Enabled'), field: 'enabled', minWidth: 70, id: 'enabled' },
		{ name: nls.localize('jobColumns.status','Status'), field: 'currentExecutionStatus', minWidth: 60, id: 'currentExecutionStatus' },
		{ name: nls.localize('jobColumns.category','Category'), field: 'category', minWidth: 150, id: 'category' },
		{ name: nls.localize('jobColumns.runnable','Runnable'), field: 'runnable', minWidth: 50, id: 'runnable' },
		{ name: nls.localize('jobColumns.schedule','Schedule'), field: 'hasSchedule', minWidth: 50, id: 'hasSchedule' },
		{ name: nls.localize('jobColumns.lastRunOutcome', 'Last Run Outcome'), field: 'lastRunOutcome', minWidth: 150, id: 'lastRunOutcome'},
	];

	private rowDetail: RowDetailView;
	private filterPlugin: any;
	private dataView: Slick.Data.DataView<any>;

	@ViewChild('jobsgrid') _gridEl: ElementRef;
	private isVisible: boolean = false;
	private isInitialized: boolean = false;
	private _table: Table<any>;
	public jobs: sqlops.AgentJobInfo[];
	public jobHistories: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; } = Object.create(null);
	private _serverName: string;
	private _isCloud: boolean;
	private _showProgressWheel: boolean;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
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
		this._isCloud = this._dashboardService.connectionManagementService.connectionInfo.serverInfo.isCloud;
	}

	ngAfterContentChecked() {
		if (this.isVisible === false && this._gridEl.nativeElement.offsetParent !== null) {
			this.isVisible = true;
			if (!this.isInitialized) {
				if (this._jobCacheObject.serverName === this._serverName && this._jobCacheObject.jobs.length > 0) {
					this._showProgressWheel = true;
					this.jobs = this._jobCacheObject.jobs;
					this.onFirstVisible(true);
					this.isInitialized = true;
				} else {
					this._showProgressWheel = true;
					this.onFirstVisible(false);
					this.isInitialized = true;
				}
			}
		} else if (this.isVisible === true && this._agentViewComponent.refresh === true) {
			this._showProgressWheel = true;
			this.onFirstVisible(false);
			this._agentViewComponent.refresh = false;
		} else if (this.isVisible === true && this._agentViewComponent.refresh === false) {
			this._showProgressWheel = true;
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
			enableCellNavigation: true,
			editable: true
		};

		this.dataView = new Slick.Data.DataView();

		let rowDetail = new RowDetailView({
			cssClass: '_detail_selector',
			process: (job) => {
				(<any>rowDetail).onAsyncResponse.notify({
					'itemDetail': job
				}, undefined, this);
			},
			useRowClick: false,
			panelRows: 1
		});
		this.rowDetail = rowDetail;
		columns.unshift(this.rowDetail.getColumnDefinition());
		let filterPlugin = new HeaderFilter({}, this.bootstrapService.themeService);
		this.filterPlugin = filterPlugin;
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

	private onJobsAvailable(jobs: sqlops.AgentJobInfo[]) {
		let jobViews = jobs.map((job) => {
			return {
				id: job.jobId,
				jobId: job.jobId,
				name: job.name,
				lastRun: AgentJobUtilities.convertToLastRun(job.lastRun),
				nextRun: AgentJobUtilities.convertToNextRun(job.nextRun),
				enabled: AgentJobUtilities.convertToResponse(job.enabled),
				currentExecutionStatus: AgentJobUtilities.convertToExecutionStatusString(job.currentExecutionStatus),
				category: job.category,
				runnable: AgentJobUtilities.convertToResponse(job.runnable),
				hasSchedule: AgentJobUtilities.convertToResponse(job.hasSchedule),
				lastRunOutcome: AgentJobUtilities.convertToStatusString(job.lastRunOutcome)
			};
		});
		this._table.registerPlugin(<any>this.rowDetail);

		this.rowDetail.onBeforeRowDetailToggle.subscribe(function(e, args) {
		});
		this.rowDetail.onAfterRowDetailToggle.subscribe(function(e, args) {
		});
		this.rowDetail.onAsyncEndUpdate.subscribe(function(e, args) {
		});
		this.filterPlugin.onFilterApplied.subscribe((e, args) => {
			this.dataView.refresh();
			this._table.grid.resetActiveCell();
			let status;
			if (this.dataView.getLength() ===  this.dataView.getItems().length) {
				status = "";
			} else {
				status = this.dataView.getLength() + ' OF ' + this.dataView.getItems().length + ' RECORDS FOUND';
			}
			$('#status-label').text(status);
		});
		this.filterPlugin.onCommand.subscribe(function (e, args: any) {
			this.dataView.fastSort(args.column.field, args.command === "sort-asc");
		});
		this._table.registerPlugin(<HeaderFilter>this.filterPlugin);

		this.dataView.beginUpdate();
		this.dataView.setItems(jobViews);
		this.dataView.setFilter((e, args) => this.filter(e, args));
		this.dataView.endUpdate();

		this._table.resizeCanvas();
		this._table.autosizeColumns();
		let expandedJobs = this._agentViewComponent.expanded;
		let expansions = 0;
		for (let i = 0; i < jobs.length; i++){
			let job = jobs[i];
			if (job.lastRunOutcome === 0 && !expandedJobs.get(job.jobId)) {
				this.expandJobRowDetails(i+expandedJobs.size);
				this.addToStyleHash(i+expandedJobs.size);
				this._agentViewComponent.setExpanded(job.jobId, 'Loading Error...');
			} else if (job.lastRunOutcome === 0 && expandedJobs.get(job.jobId)) {
				this.expandJobRowDetails(i+expansions);
				this.addToStyleHash(i+expansions);
				expansions++;
			}
		}

		$('.jobview-jobnamerow').hover(e => {
			let currentTarget = e.currentTarget;
			currentTarget.title = currentTarget.innerText;
		});
		this._showProgressWheel = false;
		this._cd.detectChanges();
		this.loadJobHistories();
	}

	private setRowWithErrorClass(hash: {[index: number]: {[id: string]: string;}}, row: number, errorClass: string) {
		hash[row] = {
			'_detail_selector': errorClass,
			'id': errorClass,
			'jobId': errorClass,
			'name': errorClass,
			'lastRun': errorClass,
			'nextRun': errorClass,
			'enabled': errorClass,
			'currentExecutionStatus': errorClass,
			'category': errorClass,
			'runnable': errorClass,
			'hasSchedule': errorClass,
			'lastRunOutcome': errorClass
		};
		return hash;
	}

	private addToStyleHash(row: number) {
		let hash : {
			[index: number]: {
			[id: string]: string;
		}} = {};
		hash = this.setRowWithErrorClass(hash, row, 'job-with-error');
		hash = this.setRowWithErrorClass(hash, row+1,  'error-row');
		this._table.grid.setCellCssStyles('error-row'+row.toString(), hash);
	}

	private renderName(row, cell, value, columnDef, dataContext) {
		let resultIndicatorClass: string;
		switch (dataContext.lastRunOutcome) {
			case ('Succeeded'):
				resultIndicatorClass = 'jobview-jobnameindicatorsuccess';
				break;
			case ('Failed'):
				resultIndicatorClass = 'jobview-jobnameindicatorfailure';
				break;
			case ('Canceled'):
				resultIndicatorClass = 'jobview-jobnameindicatorcancel';
				break;
			case ('Status Unknown'):
				resultIndicatorClass = 'jobview-jobnameindicatorunknown';
				break;
			default:
				resultIndicatorClass = 'jobview-jobnameindicatorfailure';
				break;
		}

		return '<table class="jobview-jobnametable"><tr class="jobview-jobnamerow">' +
			'<td nowrap class=' + resultIndicatorClass + '></td>' +
			'<td nowrap class="jobview-jobnametext">' + dataContext.name + '</td>' +
			'</tr></table>';
	}

	private expandJobRowDetails(rowIdx: number, message?: string): void {
		let item = this.dataView.getItemByIdx(rowIdx);
		item.message = this._agentViewComponent.expanded.get(item.jobId);
		this.rowDetail.applyTemplateNewLineHeight(item, true);
	}

	private loadJobHistories() {
		const self = this;
		if (this.jobs) {
			let erroredJobs = 0;
			for (let i = 0; i < this.jobs.length; i++) {
				let job = this.jobs[i];
				let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
				this._jobManagementService.getJobHistory(ownerUri, job.jobId).then((result) => {
					if (result.jobs) {
						self.jobHistories[job.jobId] = result.jobs;
						self._jobCacheObject.setJobHistory(job.jobId, result.jobs);
						if (self._agentViewComponent.expanded.has(job.jobId)) {
							let jobHistory = self._jobCacheObject.getJobHistory(job.jobId)[0];
							let item = self.dataView.getItemById(job.jobId + '.error');
							let noStepsMessage = nls.localize('jobsView.noSteps', 'No Steps available for this job.');
							let errorMessage = jobHistory ? jobHistory.message: noStepsMessage;
							item['name'] = nls.localize('jobsView.error', 'Error: ') + errorMessage;
							self._agentViewComponent.setExpanded(job.jobId, errorMessage);
							self.dataView.updateItem(job.jobId + '.error', item);

						}
					}
				});
			}
		}
	}

	private isErrorRow(jobName: string) {
		return jobName.includes('Error');
	}

	private getJob(args: Slick.OnClickEventArgs<any>): sqlops.AgentJobInfo {
		let row = args.row;
		let jobName = args.grid.getCellNode(row, 1).innerText.trim();
		if (this.isErrorRow(jobName)) {
			jobName = args.grid.getCellNode(row-1, 1).innerText.trim();
		}
		let job = this.jobs.filter(job => job.name === jobName)[0];
		return job;
	}

	private curateJobHistory(jobs: sqlops.AgentJobInfo[], ownerUri: string) {
		const self = this;
		for (let i = 0; i < jobs.length; i++) {
			let job = jobs[i];
			this._jobManagementService.getJobHistory(ownerUri, job.jobId).then((result) => {
				if (result && result.jobs) {
					self.jobHistories[job.jobId] = result.jobs;
					self._jobCacheObject.setJobHistory(job.jobId, result.jobs);
					if (self._agentViewComponent.expanded.has(job.jobId)) {
						let jobHistory = self._jobCacheObject.getJobHistory(job.jobId)[result.jobs.length-1];
						let item = self.dataView.getItemById(job.jobId + '.error');
						let noStepsMessage = nls.localize('jobsView.noSteps', 'No Steps available for this job.');
						let errorMessage = jobHistory ? jobHistory.message: noStepsMessage;
						item['name'] = nls.localize('jobsView.error', 'Error: ') + errorMessage;
						self._agentViewComponent.setExpanded(job.jobId, item['name']);
						self.dataView.updateItem(job.jobId + '.error', item);
					}
				}
			});
		}
	}

	private filter(item: any, args: any) {
		let columns = this._table.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			let col: any = columns[i];
			let filterValues = col.filterValues;
			if (filterValues && filterValues.length > 0) {
				value = value && _.contains(filterValues, item[col.field]);
			}
		}
		return value;
	}
}