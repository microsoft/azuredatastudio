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

import * as sqlops from 'sqlops';
import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit } from '@angular/core';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { RowDetailView } from 'sql/base/browser/ui/table/plugins/rowdetailview';
import { JobCacheObject } from 'sql/parts/jobManagement/common/jobManagementService';
import { EditJobAction, DeleteJobAction, NewJobAction } from 'sql/parts/jobManagement/common/jobActions';
import { JobManagementUtilities } from 'sql/parts/jobManagement/common/jobManagementUtilities';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';
import { JobManagementView } from 'sql/parts/jobManagement/views/jobManagementView';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardService } from 'sql/services/dashboard/common/dashboardService';

export const JOBSVIEW_SELECTOR: string = 'jobsview-component';
export const ROW_HEIGHT: number = 45;

@Component({
	selector: JOBSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => JobsViewComponent) }],
})

export class JobsViewComponent extends JobManagementView implements OnInit  {

	private columns: Array<Slick.Column<any>> = [
		{
			name: nls.localize('jobColumns.name', 'Name'),
			field: 'name',
			formatter: (row, cell, value, columnDef, dataContext) => this.renderName(row, cell, value, columnDef, dataContext),
			width: 150,
			id: 'name'
		},
		{ name: nls.localize('jobColumns.lastRun', 'Last Run'), field: 'lastRun', width: 80, id: 'lastRun' },
		{ name: nls.localize('jobColumns.nextRun', 'Next Run'), field: 'nextRun', width: 80, id: 'nextRun' },
		{ name: nls.localize('jobColumns.enabled', 'Enabled'), field: 'enabled', width: 60, id: 'enabled' },
		{ name: nls.localize('jobColumns.status', 'Status'), field: 'currentExecutionStatus', width: 50, id: 'currentExecutionStatus' },
		{ name: nls.localize('jobColumns.category', 'Category'), field: 'category', width: 100, id: 'category' },
		{ name: nls.localize('jobColumns.runnable', 'Runnable'), field: 'runnable', width: 70, id: 'runnable' },
		{ name: nls.localize('jobColumns.schedule', 'Schedule'), field: 'hasSchedule', width: 60, id: 'hasSchedule' },
		{ name: nls.localize('jobColumns.lastRunOutcome', 'Last Run Outcome'), field: 'lastRunOutcome', width: 100, id: 'lastRunOutcome' },
		{
			name: nls.localize('jobColumns.previousRuns', 'Previous Runs'),
			formatter: (row, cell, value, columnDef, dataContext) => this.renderChartsPostHistory(row, cell, value, columnDef, dataContext),
			field: 'previousRuns',
			width: 100,
			id: 'previousRuns'
		}
	];

	private _jobCacheObject: JobCacheObject;
	private rowDetail: RowDetailView;
	private filterPlugin: any;
	private dataView: any;
	private _serverName: string;
	private _isCloud: boolean;
	private filterStylingMap: { [columnName: string]: [any]; } = {};
	private filterStack = ['start'];
	private filterValueMap: { [columnName: string]: string[]; } = {};
	private sortingStylingMap: { [columnName: string]: any; } = {};

	public jobs: sqlops.AgentJobInfo[];
	public jobHistories: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; } = Object.create(null);
	public contextAction = NewJobAction;

	@ViewChild('jobsgrid') _gridEl: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(IThemeService) private _themeService: IThemeService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService)  keybindingService: IKeybindingService,
		@Inject(IDashboardService) _dashboardService: IDashboardService
	) {
		super(commonService, _dashboardService, contextMenuService, keybindingService, instantiationService);
		let jobCacheObjectMap = this._jobManagementService.jobCacheObjectMap;
		this._serverName = commonService.connectionManagementService.connectionInfo.connectionProfile.serverName;
		let jobCache = jobCacheObjectMap[this._serverName];
		if (jobCache) {
			this._jobCacheObject = jobCache;
		} else {
			this._jobCacheObject = new JobCacheObject();
			this._jobCacheObject.serverName = this._serverName;
			this._jobManagementService.addToCache(this._serverName, this._jobCacheObject);
		}
		this._isCloud = commonService.connectionManagementService.connectionInfo.serverInfo.isCloud;
	}

	ngOnInit(){
		// set base class elements
		this._visibilityElement = this._gridEl;
		this._parentComponent = this._agentViewComponent;
	}

	public layout() {
		let jobsViewToolbar = $('jobsview-component .actionbar-container').get(0);
		let statusBar = $('.part.statusbar').get(0);
		if (jobsViewToolbar && statusBar) {
			let toolbarBottom = jobsViewToolbar.getBoundingClientRect().bottom;
			let statusTop = statusBar.getBoundingClientRect().top;
			this._table.layout(new dom.Dimension(
				dom.getContentWidth(this._gridEl.nativeElement),
				statusTop - toolbarBottom));
		}
	}

	onFirstVisible() {
		let self = this;
		let cached: boolean = false;
		if (this._jobCacheObject.serverName === this._serverName && this._jobCacheObject.jobs.length > 0) {
			cached = true;
			this.jobs = this._jobCacheObject.jobs;
		}

		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		let options = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: ROW_HEIGHT,
			enableCellNavigation: true,
			forceFitColumns: true
		};

		this.dataView = new Slick.Data.DataView({ inlineFilters: false });

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
		$(this._gridEl.nativeElement).empty();
		$(this.actionBarContainer.nativeElement).empty();
		this.initActionBar();
		this._table = new Table(this._gridEl.nativeElement, undefined, columns, options);
		this._table.grid.setData(this.dataView, true);
		this._table.grid.onClick.subscribe((e, args) => {
			let job = self.getJob(args);
			self._agentViewComponent.jobId = job.jobId;
			self._agentViewComponent.agentJobInfo = job;
			self._agentViewComponent.showHistory = true;
		});

		this._register(this._table.onContextMenu((e: DOMEvent, data: Slick.OnContextMenuEventArgs<any>) => {
			self.openContextMenu(e);
		}));

		if (cached && this._agentViewComponent.refresh !== true) {
			this.onJobsAvailable(null);
			this._showProgressWheel = false;
			if (this.isVisible) {
				this._cd.detectChanges();
			}
		} else {
			let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
			this._jobManagementService.getJobs(ownerUri).then((result) => {
				if (result && result.jobs) {
					self.jobs = result.jobs;
					self._jobCacheObject.jobs = self.jobs;
					self.onJobsAvailable(result.jobs);
				} else {
					// TODO: handle error
				}

				this._showProgressWheel = false;
				if (this.isVisible) {
					this._cd.detectChanges();
				}
			});
		}
	}

	private onJobsAvailable(jobs: sqlops.AgentJobInfo[]) {
		let jobViews: any;
		let start: boolean = true;
		if (!jobs) {
			let dataView = this._jobCacheObject.dataView;
			jobViews = dataView.getItems();
			start = false;
		} else {
			jobViews = jobs.map((job) => {
				return {
					id: job.jobId,
					jobId: job.jobId,
					name: job.name,
					lastRun: JobManagementUtilities.convertToLastRun(job.lastRun),
					nextRun: JobManagementUtilities.convertToNextRun(job.nextRun),
					enabled: JobManagementUtilities.convertToResponse(job.enabled),
					currentExecutionStatus: JobManagementUtilities.convertToExecutionStatusString(job.currentExecutionStatus),
					category: job.category,
					runnable: JobManagementUtilities.convertToResponse(job.runnable),
					hasSchedule: JobManagementUtilities.convertToResponse(job.hasSchedule),
					lastRunOutcome: JobManagementUtilities.convertToStatusString(job.lastRunOutcome)
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

		this.expandJobs(start);
		// tooltip for job name
		$('.jobview-jobnamerow').hover(e => {
			let currentTarget = e.currentTarget;
			currentTarget.title = currentTarget.innerText;
		});

		const self = this;
		this._table.grid.onColumnsResized.subscribe((e, data: any) => {
			let nameWidth: number = data.grid.getColumnWidths()[1];
			// adjust job name when resized
			$('#jobsDiv .jobview-grid .slick-cell.l1.r1 .jobview-jobnametext').css('width', `${nameWidth - 10}px`);
			// adjust error message when resized
			$('#jobsDiv .jobview-grid .slick-cell.l1.r1.error-row .jobview-jobnametext').css('width', '100%');

			// generate job charts again
			self.jobs.forEach(job => {
				let jobHistories = self._jobCacheObject.getJobHistory(job.jobId);
				let previousRuns = jobHistories.slice(jobHistories.length - 5, jobHistories.length);
				self.createJobChart(job.jobId, previousRuns);
			});
		});

		$('#jobsDiv .jobview-grid .monaco-table .slick-viewport .grid-canvas .ui-widget-content.slick-row').hover((e1) =>
			this.highlightErrorRows(e1), (e2) => this.hightlightNonErrorRows(e2));

		this._table.grid.onScroll.subscribe((e) => {
			$('#jobsDiv .jobview-grid .monaco-table .slick-viewport .grid-canvas .ui-widget-content.slick-row').hover((e1) =>
				this.highlightErrorRows(e1), (e2) => this.hightlightNonErrorRows(e2));
		});

		// cache the dataview for future use
		this._jobCacheObject.dataView = this.dataView;
		this.filterValueMap['start'] = [[], this.dataView.getItems()];
		this.loadJobHistories();
	}

	private highlightErrorRows(e) {
		// highlight the error row as well if a failing job row is hovered
		if (e.currentTarget.children.item(0).classList.contains('job-with-error')) {
			let target = $(e.currentTarget);
			let targetChildren = $(e.currentTarget.children);
			let siblings = target.nextAll().toArray();
			let top = parseInt(target.css('top'), 10);
			for (let i = 0; i < siblings.length; i++) {
				let sibling = siblings[i];
				let siblingTop = parseInt($(sibling).css('top'), 10);
				if (siblingTop === top + ROW_HEIGHT) {
					$(sibling.children).addClass('hovered');
					sibling.onmouseenter = (e) => {
						targetChildren.addClass('hovered');
					};
					sibling.onmouseleave = (e) => {
						targetChildren.removeClass('hovered');
					}
					break;
				}
			}
		}
	}

	private hightlightNonErrorRows(e) {
		// switch back to original background
		if (e.currentTarget.children.item(0).classList.contains('job-with-error')) {
			let target = $(e.currentTarget);
			let siblings = target.nextAll().toArray();
			let top = parseInt(target.css('top'), 10);
			for (let i = 0; i < siblings.length; i++) {
				let sibling = siblings[i];
				let siblingTop = parseInt($(sibling).css('top'), 10);
				if (siblingTop === top + ROW_HEIGHT) {
					$(sibling.children).removeClass('hovered');
					break;
				}
			}
		}
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
		let runChart = this._jobCacheObject.getRunChart(dataContext.id);
		if (runChart && runChart.length > 0) {
			return `<table class="jobprevruns" id="${dataContext.id}">
				<tr>
					<td>${runChart[0] ? runChart[0] : '<div></div>' }</td>
					<td>${runChart[1] ? runChart[1] : '<div></div>' }</td>
					<td>${runChart[2] ? runChart[2] : '<div></div>' }</td>
					<td>${runChart[3] ? runChart[3] : '<div></div>' }</td>
					<td>${runChart[4] ? runChart[4] : '<div></div>' }</td>
				</tr>
			</table>`;
		} else {
			return `<table class="jobprevruns" id="${dataContext.id}">
			<tr>
				<td><div class="bar0"></div></td>
				<td><div class="bar1"></div></td>
				<td><div class="bar2"></div></td>
				<td><div class="bar3"></div></td>
				<td><div class="bar4"></div></td>
			</tr>
			</table>`;
		}
	}

	private expandJobRowDetails(rowIdx: number, message?: string): void {
		let item = this.dataView.getItemByIdx(rowIdx);
		item.message = this._agentViewComponent.expanded.get(item.jobId);
		this.rowDetail.applyTemplateNewLineHeight(item, true);
	}

	private loadJobHistories(): void {
		if (this.jobs) {
			let erroredJobs = 0;
			let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
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
				if (!_.contains(this.filterValueMap[column][0], item[JobManagementUtilities.convertColNameToField(column)])) {
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
		let runCharts = [];
		for (let i = 0; i < jobHistories.length; i++) {
			let runGraph = $(`table#${jobId}.jobprevruns > tbody > tr > td > div.bar${i}`);
			if (jobHistories && jobHistories.length > 0) {
				runGraph.css('height', chartHeights[i]);
				let bgColor = jobHistories[i].runStatus === 0 ? 'red' : 'green';
				runGraph.css('background', bgColor);
				runGraph.hover((e) => {
					let currentTarget = e.currentTarget;
					currentTarget.title = jobHistories[i].runDuration;
				});
				if (runGraph.get(0)) {
					runCharts.push(runGraph.get(0).outerHTML);
				}
			} else {
				runGraph.css('height', '5px');
				runGraph.css('background', 'red');
				runGraph.hover((e) => {
					let currentTarget = e.currentTarget;
					currentTarget.title = 'Job not run.';
				});
			}
		}
		if (runCharts.length > 0) {
			this._jobCacheObject.setRunChart(jobId, runCharts);
		}
	}

	// chart height normalization logic
	private getChartHeights(jobHistories: sqlops.AgentJobHistoryInfo[]): string[] {
		if (!jobHistories || jobHistories.length === 0) {
			return ['5px', '5px', '5px', '5px', '5px'];
		}
		let maxDuration: number = 0;
		jobHistories.forEach(history => {
			let historyDuration = JobManagementUtilities.convertDurationToSeconds(history.runDuration);
			if (historyDuration > maxDuration) {
				maxDuration = historyDuration;
			}
		});
		maxDuration = maxDuration === 0 ? 1 : maxDuration;
		let maxBarHeight: number = 24;
		let chartHeights = [];
		for (let i = 0; i < jobHistories.length; i++) {
			let duration = jobHistories[i].runDuration;
			let chartHeight = (maxBarHeight * JobManagementUtilities.convertDurationToSeconds(duration)) / maxDuration;
			chartHeights.push(`${chartHeight}px`);
		}
		return chartHeights;
	}

	private expandJobs(start: boolean): void {
		if (start) {
			this._agentViewComponent.expanded = new Map<string, string>();
		}
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

	protected getTableActions(): TPromise<IAction[]> {
		let actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(EditJobAction));
		actions.push(this._instantiationService.createInstance(DeleteJobAction));
		return TPromise.as(actions);
	}

	protected getCurrentTableObject(rowIndex: number): any {
		let data = this._table.grid.getData();
		if (!data || rowIndex >= data.getLength()) {
			return undefined;
		}

		let jobId =  data.getItem(rowIndex).jobId;
		let job = this.jobs.filter(job => {
			return job.jobId === jobId;
		});

		return job && job.length > 0 ? job[0] : undefined;
	}

	public openCreateJobDialog() {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		this._commandService.executeCommand('agent.openJobDialog', ownerUri);
	}

	public refreshJobs() {
		this._agentViewComponent.refresh = true;
	}
}