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

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

import * as nls from 'vs/nls';

import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/common/theme/styler';
import { JobHistoryComponent } from 'src/sql/parts/jobManagement/views/jobHistory.component';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { RowDetailView } from 'sql/base/browser/ui/table/plugins/rowdetailview';
import { JobCacheObject } from 'sql/parts/jobManagement/common/jobManagementService';
import { AgentJobUtilities } from 'sql/parts/jobManagement/common/agentJobUtilities';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { BaseFocusDirectionTerminalAction } from 'vs/workbench/parts/terminal/electron-browser/terminalActions';
import * as Utils from 'sql/parts/connection/common/utils';
import * as dom from 'vs/base/browser/dom';
import { IJobManagementService } from '../common/interfaces';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { ICommandService } from 'vs/platform/commands/common/commands';


export const JOBSVIEW_SELECTOR: string = 'jobsview-component';

@Component({
	selector: JOBSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => JobsViewComponent) }],
})

export class JobsViewComponent implements AfterContentChecked {

	private _jobCacheObject: JobCacheObject;

	private _disposables = new Array<vscode.Disposable>();

	private columns: Array<Slick.Column<any>> = [
		{ name: nls.localize('jobColumns.name', 'Name'), field: 'name', formatter: (row, cell, value, columnDef, dataContext) => this.renderName(row, cell, value, columnDef, dataContext), width: 200, id: 'name' },
		{ name: nls.localize('jobColumns.lastRun', 'Last Run'), field: 'lastRun', width: 120, id: 'lastRun' },
		{ name: nls.localize('jobColumns.nextRun', 'Next Run'), field: 'nextRun', width: 120, id: 'nextRun' },
		{ name: nls.localize('jobColumns.enabled', 'Enabled'), field: 'enabled', width: 50, id: 'enabled' },
		{ name: nls.localize('jobColumns.status', 'Status'), field: 'currentExecutionStatus', width: 60, id: 'currentExecutionStatus' },
		{ name: nls.localize('jobColumns.category', 'Category'), field: 'category', width: 120, id: 'category' },
		{ name: nls.localize('jobColumns.runnable', 'Runnable'), field: 'runnable', width: 70, id: 'runnable' },
		{ name: nls.localize('jobColumns.schedule', 'Schedule'), field: 'hasSchedule', width: 60, id: 'hasSchedule' },
		{ name: nls.localize('jobColumns.lastRunOutcome', 'Last Run Outcome'), field: 'lastRunOutcome', width: 120, id: 'lastRunOutcome' },
		{ name: nls.localize('jobColumns.previousRuns', 'Previous Runs'), formatter: this.renderChartsPostHistory, field: 'previousRuns', width: 80, id: 'previousRuns' }
	];


	private options: Slick.GridOptions<any> = {
		syncColumnCellResize: true,
		enableColumnReorder: false,
		rowHeight: 45,
		enableCellNavigation: true,
		editable: true
	};

	private rowDetail: RowDetailView;
	private filterPlugin: any;
	private dataView: any;

	@ViewChild('jobsgrid') _gridEl: ElementRef;
	private isVisible: boolean = false;
	private isInitialized: boolean = false;
	private _table: Table<any>;
	public jobs: sqlops.AgentJobInfo[];
	public jobHistories: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; } = Object.create(null);
	private _serverName: string;
	private _isCloud: boolean;
	private _showProgressWheel: boolean;
	private _tabHeight: number;
	private filterStylingMap: { [columnName: string]: [any]; } = {};
	private filterStack = ['start'];
	private filterValueMap: { [columnName: string]: string[]; } = {};
	private sortingStylingMap: { [columnName: string]: any; } = {};

	private NewJobText: string = nls.localize("jobsToolbar-NewJob", "New job");
	private RefreshText: string = nls.localize("jobsToolbar-Refresh", "Refresh");

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(IThemeService) private _themeService: IThemeService,
		@Inject(ICommandService) private _commandService: ICommandService
	) {
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

	public layout() {
		this._table.layout(new dom.Dimension(dom.getContentWidth(this._gridEl.nativeElement), dom.getContentHeight(this._gridEl.nativeElement)));
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
		// create the table
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
		let filterPlugin = new HeaderFilter({}, this._themeService);
		this.filterPlugin = filterPlugin;
		this._table = new Table(this._gridEl.nativeElement, undefined, columns, this.options);



		this._table.grid.setData(this.dataView, true);
		this._table.grid.onClick.subscribe((e, args) => {
			let job = self.getJob(args);
			self._agentViewComponent.jobId = job.jobId;
			self._agentViewComponent.agentJobInfo = job;
			self._agentViewComponent.showHistory = true;
		});
		if (cached && this._agentViewComponent.refresh !== true) {
			this.onJobsAvailable(null);
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
		let jobViews: any;
		if (!jobs) {
			let dataView = this._jobCacheObject.dataView;
			jobViews = dataView.getItems();
		} else {
			jobViews = jobs.map((job) => {
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
		}
		this._table.registerPlugin(<any>this.rowDetail);
		this.filterPlugin.onFilterApplied.subscribe((e, args) => {
			this.dataView.refresh();
			this._table.grid.resetActiveCell();
			let filterValues = args.column.filterValues;
			if (filterValues) {
				if (filterValues.length === 0) {
					// if an associated styling exists with the current filters
					if (this.filterStylingMap[args.column.name]) {
						let filterLength = this.filterStylingMap[args.column.name].length;
						// then remove the filtered styling
						for (let i = 0; i < filterLength; i++) {
							let lastAppliedStyle = this.filterStylingMap[args.column.name].pop();
							this._table.grid.removeCellCssStyles(lastAppliedStyle[0]);
						}
						delete this.filterStylingMap[args.column.name];
						let index = this.filterStack.indexOf(args.column.name, 0);
						if (index > -1) {
							this.filterStack.splice(index, 1);
							delete this.filterValueMap[args.column.name];
						}
						// apply the previous filter styling
						let currentItems = this.dataView.getFilteredItems();
						let styledItems = this.filterValueMap[this.filterStack[this.filterStack.length - 1]][1];
						if (styledItems === currentItems) {
							let lastColStyle = this.filterStylingMap[this.filterStack[this.filterStack.length - 1]];
							for (let i = 0; i < lastColStyle.length; i++) {
								this._table.grid.setCellCssStyles(lastColStyle[i][0], lastColStyle[i][1]);
							}
						} else {
							// style it all over again
							let seenJobs = 0;
							for (let i = 0; i < currentItems.length; i++) {
								this._table.grid.removeCellCssStyles('error-row' + i.toString());
								let item = this.dataView.getFilteredItems()[i];
								if (item.lastRunOutcome === 'Failed') {
									this.addToStyleHash(seenJobs, false, this.filterStylingMap, args.column.name);
									if (this.filterStack.indexOf(args.column.name) < 0) {
										this.filterStack.push(args.column.name);
										this.filterValueMap[args.column.name] = [filterValues];
									}
									// one expansion for the row and one for
									// the error detail
									seenJobs++;
									i++;
								}
								seenJobs++;
							}
							this.dataView.refresh();
							this.filterValueMap[args.column.name].push(this.dataView.getFilteredItems());
							this._table.grid.resetActiveCell();
						}
						if (this.filterStack.length === 0) {
							this.filterStack = ['start'];
						}
					}
				} else {
					let seenJobs = 0;
					for (let i = 0; i < this.jobs.length; i++) {
						this._table.grid.removeCellCssStyles('error-row' + i.toString());
						let item = this.dataView.getItemByIdx(i);
						// current filter
						if (_.contains(filterValues, item[args.column.field])) {
							// check all previous filters
							if (this.checkPreviousFilters(item)) {
								if (item.lastRunOutcome === 'Failed') {
									this.addToStyleHash(seenJobs, false, this.filterStylingMap, args.column.name);
									if (this.filterStack.indexOf(args.column.name) < 0) {
										this.filterStack.push(args.column.name);
										this.filterValueMap[args.column.name] = [filterValues];
									}
									// one expansion for the row and one for
									// the error detail
									seenJobs++;
									i++;
								}
								seenJobs++;
							}
						}
					}
					this.dataView.refresh();
					if (this.filterValueMap[args.column.name]) {
						this.filterValueMap[args.column.name].push(this.dataView.getFilteredItems());
					} else {
						this.filterValueMap[args.column.name] = this.dataView.getFilteredItems();
					}

					this._table.grid.resetActiveCell();
				}
			} else {
				this.expandJobs(false);
			}
		});
		this.filterPlugin.onCommand.subscribe((e, args: any) => {
			this.columnSort(args.column.name, args.command === 'sort-asc');
		});
		this._table.registerPlugin(<HeaderFilter>this.filterPlugin);

		this.dataView.beginUpdate();
		this.dataView.setItems(jobViews);
		this.dataView.setFilter((item) => this.filter(item));

		this.dataView.endUpdate();
		this._table.autosizeColumns();
		this._table.resizeCanvas();

		this.expandJobs(true);
		// tooltip for job name
		$('.jobview-jobnamerow').hover(e => {
			let currentTarget = e.currentTarget;
			currentTarget.title = currentTarget.innerText;
		});
		this._showProgressWheel = false;
		this._cd.detectChanges();
		const self = this;
		this._tabHeight = $('agentview-component #jobsDiv .jobview-grid').get(0).clientHeight;
		$(window).resize(() => {
			let currentTab = $('agentview-component #jobsDiv .jobview-grid').get(0);
			if (currentTab) {
				let currentTabHeight = currentTab.clientHeight;
				if (currentTabHeight < self._tabHeight) {
					$('agentview-component #jobsDiv div.ui-widget').css('height', `${currentTabHeight - 22}px`);
					self._table.resizeCanvas();
				} else {
					$('agentview-component #jobsDiv div.ui-widget').css('height', `${currentTabHeight}px`);
					self._table.resizeCanvas();
				}
				self._tabHeight = currentTabHeight;
			}
		});
		this._table.grid.onColumnsResized.subscribe((e, data: any) => {
			let nameWidth: number = data.grid.getColumnWidths()[1];
			// adjust job name when resized
			$('#jobsDiv .jobview-grid .slick-cell.l1.r1 .jobview-jobnametext').css('width', `${nameWidth - 10}px`);
			// adjust error message when resized
			$('#jobsDiv .jobview-grid .slick-cell.l1.r1.error-row .jobview-jobnametext').css('width', '100%');

			// generate job charts again
			self.jobs.forEach(job => {
				let jobId = job.jobId;
				let jobHistories = self._jobCacheObject.getJobHistory(job.jobId);
				let previousRuns = jobHistories.slice(jobHistories.length - 5, jobHistories.length);
				self.createJobChart(job.jobId, previousRuns);
			});
		});
		// cache the dataview for future use
		this._jobCacheObject.dataView = this.dataView;
		this.filterValueMap['start'] = [[], this.dataView.getItems()];
		this.loadJobHistories();
	}

	private setRowWithErrorClass(hash: { [index: number]: { [id: string]: string; } }, row: number, errorClass: string) {
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
			'lastRunOutcome': errorClass,
			'previousRuns': errorClass
		};
		return hash;
	}

	private addToStyleHash(row: number, start: boolean, map: any, columnName: string) {
		let hash: {
			[index: number]: {
				[id: string]: string;
			}
		} = {};
		hash = this.setRowWithErrorClass(hash, row, 'job-with-error');
		hash = this.setRowWithErrorClass(hash, row + 1, 'error-row');
		if (start) {
			if (map['start']) {
				map['start'].push(['error-row' + row.toString(), hash]);
			} else {
				map['start'] = [['error-row' + row.toString(), hash]];
			}
		} else {
			if (map[columnName]) {
				map[columnName].push(['error-row' + row.toString(), hash]);
			} else {
				map[columnName] = [['error-row' + row.toString(), hash]];
			}
		}
		this._table.grid.setCellCssStyles('error-row' + row.toString(), hash);
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

	private renderChartsPostHistory(row, cell, value, columnDef, dataContext) {
		return `<table class="jobprevruns" id="${dataContext.id}">
				<tr>
					<td><div class="bar1"></div></td>
					<td><div class="bar2"></div></td>
					<td><div class="bar3"></div></td>
					<td><div class="bar4"></div></td>
				</tr>
				</table>`;
	}

	private expandJobRowDetails(rowIdx: number, message?: string): void {
		let item = this.dataView.getItemByIdx(rowIdx);
		item.message = this._agentViewComponent.expanded.get(item.jobId);
		this.rowDetail.applyTemplateNewLineHeight(item, true);
	}

	private loadJobHistories(): void {
		if (this.jobs) {
			let erroredJobs = 0;
			let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
			let separatedJobs = this.separateFailingJobs();
			// grab histories of the failing jobs first
			// so they can be expanded quicker
			let failing = separatedJobs[0];
			this.curateJobHistory(failing, ownerUri);
			let passing = separatedJobs[1];
			this.curateJobHistory(passing, ownerUri);
		}
	}

	private separateFailingJobs(): sqlops.AgentJobInfo[][] {
		let failing = [];
		let nonFailing = [];
		for (let i = 0; i < this.jobs.length; i++) {
			if (this.jobs[i].lastRunOutcome === 0) {
				failing.push(this.jobs[i]);
			} else {
				nonFailing.push(this.jobs[i]);
			}
		}
		return [failing, nonFailing];
	}

	private checkPreviousFilters(item): boolean {
		for (let column in this.filterValueMap) {
			if (column !== 'start' && this.filterValueMap[column][0].length > 0) {
				if (!_.contains(this.filterValueMap[column][0], item[AgentJobUtilities.convertColNameToField(column)])) {
					return false;
				}
			}
		}
		return true;
	}

	private isErrorRow(cell: HTMLElement) {
		return cell.classList.contains('error-row');
	}

	private getJob(args: Slick.OnClickEventArgs<any>): sqlops.AgentJobInfo {
		let row = args.row;
		let jobName: string;
		let cell = args.grid.getCellNode(row, 1);
		if (this.isErrorRow(cell)) {
			jobName = args.grid.getCellNode(row - 1, 1).innerText.trim();
		} else {
			jobName = cell.innerText.trim();
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
					let jobHistories = self._jobCacheObject.getJobHistory(job.jobId);
					let previousRuns = jobHistories.slice(jobHistories.length - 5, jobHistories.length);
					self.createJobChart(job.jobId, previousRuns);
					if (self._agentViewComponent.expanded.has(job.jobId)) {
						let lastJobHistory = jobHistories[result.jobs.length - 1];
						let item = self.dataView.getItemById(job.jobId + '.error');
						let noStepsMessage = nls.localize('jobsView.noSteps', 'No Steps available for this job.');
						let errorMessage = lastJobHistory ? lastJobHistory.message : noStepsMessage;
						item['name'] = nls.localize('jobsView.error', 'Error: ') + errorMessage;
						self._agentViewComponent.setExpanded(job.jobId, item['name']);
						self.dataView.updateItem(job.jobId + '.error', item);
					}
				}
			});
		}
	}

	private createJobChart(jobId: string, jobHistories: sqlops.AgentJobHistoryInfo[]): void {
		let chartHeights = this.getChartHeights(jobHistories);
		for (let i = 0; i < jobHistories.length; i++) {
			let runGraph = $(`table#${jobId}.jobprevruns > tbody > tr > td > div.bar${i + 1}`);
			if (jobHistories && jobHistories.length > 0) {
				runGraph.css('height', chartHeights[i]);
				let bgColor = jobHistories[i].runStatus === 0 ? 'red' : 'green';
				runGraph.css('background', bgColor);
				runGraph.hover((e) => {
					let currentTarget = e.currentTarget;
					currentTarget.title = jobHistories[i].runDuration;
				});
			} else {
				runGraph.css('height', '5px');
				runGraph.css('background', 'red');
				runGraph.hover((e) => {
					let currentTarget = e.currentTarget;
					currentTarget.title = 'Job not run.';
				});
			}
		}
	}

	// chart height normalization logic
	private getChartHeights(jobHistories: sqlops.AgentJobHistoryInfo[]): string[] {
		if (!jobHistories || jobHistories.length === 0) {
			return ['5px', '5px', '5px', '5px', '5px'];
		}
		let maxDuration: number = 0;
		jobHistories.forEach(history => {
			let historyDuration = AgentJobUtilities.convertDurationToSeconds(history.runDuration);
			if (historyDuration > maxDuration) {
				maxDuration = historyDuration;
			}
		});
		maxDuration = maxDuration === 0 ? 1 : maxDuration;
		let maxBarHeight: number = 24;
		let chartHeights = [];
		for (let i = 0; i < jobHistories.length; i++) {
			let duration = jobHistories[i].runDuration;
			let chartHeight = (maxBarHeight * AgentJobUtilities.convertDurationToSeconds(duration)) / maxDuration;
			chartHeights.push(`${chartHeight}px`);
		}
		return chartHeights;
	}

	private expandJobs(start: boolean): void {
		let expandedJobs = this._agentViewComponent.expanded;
		let expansions = 0;
		for (let i = 0; i < this.jobs.length; i++) {
			let job = this.jobs[i];
			if (job.lastRunOutcome === 0 && !expandedJobs.get(job.jobId)) {
				this.expandJobRowDetails(i + expandedJobs.size);
				this.addToStyleHash(i + expandedJobs.size, start, this.filterStylingMap, undefined);
				this._agentViewComponent.setExpanded(job.jobId, 'Loading Error...');
			} else if (job.lastRunOutcome === 0 && expandedJobs.get(job.jobId)) {
				this.addToStyleHash(i + expansions, start, this.filterStylingMap, undefined);
				expansions++;
			}
		}
	}

	private filter(item: any) {
		let columns = this._table.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			let col: any = columns[i];
			let filterValues = col.filterValues;
			if (filterValues && filterValues.length > 0) {
				if (item._parent) {
					value = value && _.contains(filterValues, item._parent[col.field]);
				} else {
					value = value && _.contains(filterValues, item[col.field]);
				}
			}
		}
		return value;
	}

	private columnSort(column: string, isAscending: boolean) {
		let items = this.dataView.getItems();
		// get error items here and remove them
		let jobItems = items.filter(x => x._parent === undefined);
		let errorItems = items.filter(x => x._parent !== undefined);
		this.sortingStylingMap[column] = items;
		switch (column) {
			case ('Name'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.name.localeCompare(item2.name);
				}, isAscending);
				break;
			}
			case ('Last Run'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => this.dateCompare(item1, item2, true), isAscending);
				break;
			}
			case ('Next Run'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => this.dateCompare(item1, item2, false), isAscending);
				break;
			}
			case ('Enabled'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.enabled.localeCompare(item2.enabled);
				}, isAscending);
				break;
			}
			case ('Status'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.currentExecutionStatus.localeCompare(item2.currentExecutionStatus);
				}, isAscending);
				break;
			}
			case ('Category'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.category.localeCompare(item2.category);
				}, isAscending);
				break;
			}
			case ('Runnable'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.runnable.localeCompare(item2.runnable);
				}, isAscending);
				break;
			}
			case ('Schedule'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.hasSchedule.localeCompare(item2.hasSchedule);
				}, isAscending);
				break;
			}
			case ('Last Run Outcome'): {
				this.dataView.setItems(jobItems);
				// sort the actual jobs
				this.dataView.sort((item1, item2) => {
					return item1.lastRunOutcome.localeCompare(item2.lastRunOutcome);
				}, isAscending);
				break;
			}
		}
		// insert the errors back again
		let jobItemsLength = jobItems.length;
		for (let i = 0; i < jobItemsLength; i++) {
			let item = jobItems[i];
			if (item._child) {
				let child = errorItems.find(error => error === item._child);
				jobItems.splice(i + 1, 0, child);
				jobItemsLength++;
			}
		}
		this.dataView.setItems(jobItems);
		// remove old style
		if (this.filterStylingMap[column]) {
			let filterLength = this.filterStylingMap[column].length;
			for (let i = 0; i < filterLength; i++) {
				let lastAppliedStyle = this.filterStylingMap[column].pop();
				this._table.grid.removeCellCssStyles(lastAppliedStyle[0]);
			}
		} else {
			for (let i = 0; i < this.jobs.length; i++) {
				this._table.grid.removeCellCssStyles('error-row' + i.toString());
			}
		}
		// add new style to the items back again
		items = this.filterStack.length > 1 ? this.dataView.getFilteredItems() : this.dataView.getItems();
		for (let i = 0; i < items.length; i++) {
			let item = items[i];
			if (item.lastRunOutcome === 'Failed') {
				this.addToStyleHash(i, false, this.sortingStylingMap, column);
			}
		}
	}

	private dateCompare(item1: any, item2: any, lastRun: boolean): number {
		let exceptionString = lastRun ? 'Never Run' : 'Not Scheduled';
		if (item2.lastRun === exceptionString && item1.lastRun !== exceptionString) {
			return -1;
		} else if (item1.lastRun === exceptionString && item2.lastRun !== exceptionString) {
			return 1;
		} else if (item1.lastRun === exceptionString && item2.lastRun === exceptionString) {
			return 0;
		} else {
			let date1 = new Date(item1.lastRun);
			let date2 = new Date(item2.lastRun);
			if (date1 > date2) {
				return 1;
			} else if (date1 === date2) {
				return 0;
			} else {
				return -1;
			}
		}
	}

	private openCreateJobDialog() {
		this._commandService.executeCommand("agent.openCreateJobDialog");
	}

	private refreshJobs() {
		this._agentViewComponent.refresh = true;
	}
}