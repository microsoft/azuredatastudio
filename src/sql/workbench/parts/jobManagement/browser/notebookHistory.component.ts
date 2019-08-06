/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/jobHistory';

import * as azdata from 'azdata';
import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { OnInit, Component, Inject, Input, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy, Injectable, PipeTransform, Pipe } from '@angular/core';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { AgentViewComponent } from 'sql/workbench/parts/jobManagement/browser/agentView.component';
import { CommonServiceInterface } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { RunJobAction, StopJobAction, JobsRefreshAction, OpenNotebookAction, EditNotebookJobAction } from 'sql/platform/jobManagement/browser/jobActions';
import { NotebookCacheObject } from 'sql/platform/jobManagement/common/jobManagementService';
import { JobManagementUtilities } from 'sql/platform/jobManagement/common/jobManagementUtilities';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import {
	JobHistoryController, JobHistoryDataSource,
	JobHistoryRenderer, JobHistoryFilter, JobHistoryModel, JobHistoryRow
} from 'sql/workbench/parts/jobManagement/browser/jobHistoryTree';
import { JobStepsViewRow } from 'sql/workbench/parts/jobManagement/browser/jobStepsViewTree';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { JobManagementView, JobActionContext } from 'sql/workbench/parts/jobManagement/browser/jobManagementView';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { View } from 'vs/editor/browser/view/viewImpl';

export const DASHBOARD_SELECTOR: string = 'notebookhistory-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookHistory.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => NotebookHistoryComponent) }],
	changeDetection: ChangeDetectionStrategy.OnPush
})
@Injectable()
export class NotebookHistoryComponent extends JobManagementView implements OnInit {



	@ViewChild('table') private _tableContainer: ElementRef;
	@ViewChild('jobsteps') private _jobStepsView: ElementRef;
	@ViewChild('notebookHistoryActionbarContainer') private _notebookHistoryActionbarView: ElementRef;

	@Input() public agentJobInfo: azdata.AgentJobInfo = undefined;
	@Input() public agentJobHistories: azdata.AgentJobHistoryInfo[] = undefined;
	public notebookHistories: azdata.AgentNotebookHistoryInfo[] = undefined;
	public agentNotebookHistoryInfo: azdata.AgentNotebookHistoryInfo = undefined;

	private _isVisible: boolean = false;
	private _stepRows: JobStepsViewRow[] = [];
	private _showSteps: boolean = undefined;
	private _showPreviousRuns: boolean = undefined;
	private _runStatus: string = undefined;
	private _notebookCacheObject: NotebookCacheObject;
	private _agentJobInfo: azdata.AgentJobInfo;
	private _agentNotebookInfo: azdata.AgentNotebookInfo;
	private _noJobsAvailable: boolean = false;
	protected _notebookHistoryActionBar: Taskbar;

	// Job Actions
	private _editNotebookJobAction: EditNotebookJobAction;
	private _runJobAction: RunJobAction;
	private _stopJobAction: StopJobAction;
	private _refreshAction: JobsRefreshAction;

	//Notebook Actions
	private _openMaterializedNotebookAction: OpenNotebookAction;

	private static readonly HEADING_HEIGHT: number = 24;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => AgentViewComponent)) _agentViewComponent: AgentViewComponent,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) dashboardService: IDashboardService,
		@Inject(ITelemetryService) private _telemetryService: ITelemetryService
	) {
		super(commonService, dashboardService, contextMenuService, keybindingService, instantiationService, _agentViewComponent);
		let notebookCacheObjectMap = this._jobManagementService.notebookCacheObjectMap;
		this._serverName = commonService.connectionManagementService.connectionInfo.connectionProfile.serverName;
		let notebookCache = notebookCacheObjectMap[this._serverName];
		if (notebookCache) {
			this._notebookCacheObject = notebookCache;
		} else {
			this._notebookCacheObject = new NotebookCacheObject();
			this._notebookCacheObject.serverName = this._serverName;
			this._jobManagementService.addToCache(this._serverName, this._notebookCacheObject);
		}
	}

	ngOnInit() {
		// set base class elements
		this._visibilityElement = this._tableContainer;
		this._parentComponent = this._agentViewComponent;
		this._agentJobInfo = this._agentViewComponent.agentJobInfo;
		this._agentNotebookInfo = this._agentViewComponent.agentNotebookInfo;
		this.initActionBar();
		const self = this;
		this._telemetryService.publicLog(TelemetryKeys.JobHistoryView);
	}

	private loadHistory() {
		const self = this;
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let jobName = this._agentViewComponent.agentJobInfo.name;
		let jobId = this._agentViewComponent.jobId;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		this._jobManagementService.getNotebookHistory(ownerUri, jobId, jobName, targetDatabase).then((result) => {
			if (result && result.histories) {
				console.log(result.histories);
				this.notebookHistories = result.histories.reverse();
				self._notebookCacheObject.setNotebookHistory(jobId, result.histories);
				self._notebookCacheObject.setJobSchedules(jobId, result.schedules);
				self._notebookCacheObject.setJobSteps(jobId, result.steps);
				this._agentViewComponent.agentJobInfo.jobSteps = this._notebookCacheObject.getJobSteps(jobId);
				this._agentViewComponent.agentJobInfo.jobSchedules = this._notebookCacheObject.getJobSchedules(jobId);
				this._agentJobInfo = this._agentViewComponent.agentJobInfo;
				this._agentNotebookInfo = this._agentViewComponent.agentNotebookInfo;
				if (result.histories.length > 0) {
					self._noJobsAvailable = false;
					self._showPreviousRuns = true;
				} else {
					self._notebookCacheObject.setNotebookHistory(self._agentViewComponent.jobId, result.histories);
					self._noJobsAvailable = true;
					self._showPreviousRuns = false;
				}
			} else {
				self._noJobsAvailable = true;
				self._showPreviousRuns = false;
				self._showSteps = false;
			}
			this._actionBar.context = { targetObject: { canEdit: true, job: this._agentJobInfo }, ownerUri: this.ownerUri, component: this };
			this._editNotebookJobAction.enabled = true;
			this._actionBar.setContent([
				{ action: this._runJobAction },
				{ action: this._stopJobAction },
				{ action: this._refreshAction },
				{ action: this._editNotebookJobAction }
			]);
			if (self._agentViewComponent.showNotebookHistory) {
				self._cd.detectChanges();
			}
		});
	}

	private setStepsTree(element: JobHistoryRow) {
		const self = this;
		let cachedHistory = self._notebookCacheObject.getNotebookHistory(element.jobID);
		if (cachedHistory) {
			self.agentNotebookHistoryInfo = cachedHistory.find(
				history => self.formatTime(history.runDate) === self.formatTime(element.runDate));
		}
		if (self.agentNotebookHistoryInfo) {
			self.agentNotebookHistoryInfo.runDate = self.formatTime(self.agentNotebookHistoryInfo.runDate);
			if (self.agentNotebookHistoryInfo.steps) {
				let jobStepStatus = this.didJobFail(self.agentNotebookHistoryInfo);
				self._stepRows = self.agentNotebookHistoryInfo.steps.map(step => {
					let stepViewRow = new JobStepsViewRow();
					stepViewRow.message = step.message;
					stepViewRow.runStatus = jobStepStatus ? JobManagementUtilities.convertToStatusString(0) :
						JobManagementUtilities.convertToStatusString(step.runStatus);
					self._runStatus = JobManagementUtilities.convertToStatusString(self.agentNotebookHistoryInfo.runStatus);
					stepViewRow.stepName = step.stepDetails.stepName;
					stepViewRow.stepId = step.stepDetails.id.toString();
					return stepViewRow;
				});
				self._stepRows.unshift(new JobStepsViewRow());
				self._stepRows[0].rowID = 'stepsColumn' + self._agentJobInfo.jobId;
				self._stepRows[0].stepId = nls.localize('stepRow.stepID', "Step ID");
				self._stepRows[0].stepName = nls.localize('stepRow.stepName', "Step Name");
				self._stepRows[0].message = nls.localize('stepRow.message', "Message");
				this._showSteps = self._stepRows.length > 1;
			} else {
				self._showSteps = false;
			}
			if (self._agentViewComponent.showNotebookHistory) {
				self._cd.detectChanges();
			}
		}
	}

	private didJobFail(job: azdata.AgentJobHistoryInfo): boolean {
		for (let i = 0; i < job.steps.length; i++) {
			if (job.steps[i].runStatus === 0) {
				return true;
			}
		}
		return false;
	}
	// let sortedRows = jobHistoryRows.sort((row1, row2) => {
	// 	let date1 = new Date(row1.runDate).getTime();
	// 	let date2 = new Date(row2.runDate).getTime();
	// 	return date2 - date1;
	// });

	private toggleCollapse(): void {
		let arrow: HTMLElement = jQuery('.resultsViewCollapsible').get(0);
		let checkbox: any = document.getElementById('accordion');
		if (arrow.className === 'resultsViewCollapsible' && checkbox.checked === false) {
			arrow.className = 'resultsViewCollapsible collapsed';
		} else if (arrow.className === 'resultsViewCollapsible collapsed' && checkbox.checked === true) {
			arrow.className = 'resultsViewCollapsible';
		}

	}

	private toggleHistoryDisplay(event): void {
		let header = event.srcElement.attributes;
		console.log(header);
	}

	private goToJobs(): void {
		this._isVisible = false;
		this._agentViewComponent.showNotebookHistory = false;
	}

	private convertToJobHistoryRow(historyInfo: azdata.AgentJobHistoryInfo): JobHistoryRow {
		let jobHistoryRow = new JobHistoryRow();
		jobHistoryRow.runDate = this.formatTime(historyInfo.runDate);
		jobHistoryRow.runStatus = JobManagementUtilities.convertToStatusString(historyInfo.runStatus);
		jobHistoryRow.instanceID = historyInfo.instanceId;
		jobHistoryRow.jobID = historyInfo.jobId;
		return jobHistoryRow;
	}

	private formatTime(time: string): string {

		return time.replace('T', ' ');
	}

	private formatDateTimetoLocaleDate(time: string) {
		let dateInstance = new Date(time);
		return dateInstance.toLocaleDateString();
	}

	private formatDateTimetoLocaleTime(time: string) {
		let dateInstance = new Date(time);
		return dateInstance.toLocaleTimeString();
	}


	private showProgressWheel(): boolean {
		return this._showPreviousRuns !== true && this._noJobsAvailable === false;
	}

	public onFirstVisible() {
		this._agentJobInfo = this._agentViewComponent.agentJobInfo;

		if (!this.agentJobInfo) {
			this.agentJobInfo = this._agentJobInfo;
		}

		if (this.isRefreshing) {
			this.loadHistory();
			return;
		}

		let jobHistories = this._notebookCacheObject.notebookHistories[this._agentViewComponent.jobId];
		this.notebookHistories = jobHistories.reverse();
		if (jobHistories) {
			if (jobHistories.length > 0) {
				const self = this;
				this._noJobsAvailable = false;
				if (this._notebookCacheObject.prevJobID === this._agentViewComponent.jobId || jobHistories[0].jobId === this._agentViewComponent.jobId) {
					this._showPreviousRuns = true;
					this._agentViewComponent.agentJobInfo.jobSteps = this._notebookCacheObject.getJobSteps(this._agentJobInfo.jobId);
					this._agentViewComponent.agentJobInfo.jobSchedules = this._notebookCacheObject.getJobSchedules(this._agentJobInfo.jobId);
					this._agentJobInfo = this._agentViewComponent.agentJobInfo;
				}
			} else if (jobHistories.length === 0) {
				this._showPreviousRuns = false;
				this._showSteps = false;
				this._noJobsAvailable = true;
			}
			this._editNotebookJobAction.enabled = true;
			this._actionBar.setContent([
				{ action: this._runJobAction },
				{ action: this._stopJobAction },
				{ action: this._refreshAction },
				{ action: this._editNotebookJobAction }
			]);
			this._cd.detectChanges();

		} else {
			this.loadHistory();
		}
		this._notebookCacheObject.prevJobID = this._agentViewComponent.jobId;
	}

	public layout() {
		let historyDetails = jQuery('.overview-container').get(0);
		let statusBar = jQuery('.part.statusbar').get(0);
		if (historyDetails && statusBar) {
			let historyBottom = historyDetails.getBoundingClientRect().bottom;
			let statusTop = statusBar.getBoundingClientRect().top;

			let height: number = statusTop - historyBottom - NotebookHistoryComponent.HEADING_HEIGHT;

			if (this._table) {
				this._table.layout(new dom.Dimension(
					dom.getContentWidth(this._tableContainer.nativeElement),
					height));
			}
		}
	}

	protected initActionBar() {
		this._runJobAction = this.instantiationService.createInstance(RunJobAction);
		this._stopJobAction = this.instantiationService.createInstance(StopJobAction);
		this._editNotebookJobAction = this.instantiationService.createInstance(EditNotebookJobAction);
		this._refreshAction = this.instantiationService.createInstance(JobsRefreshAction);
		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._editNotebookJobAction.enabled = !this.showProgressWheel();
		let targetObject: JobActionContext = { canEdit: !this.showProgressWheel(), job: this._agentJobInfo };
		this._actionBar.context = { targetObject: targetObject, ownerUri: this.ownerUri, component: this };
		this._actionBar.setContent([
			{ action: this._runJobAction },
			{ action: this._stopJobAction },
			{ action: this._refreshAction },
			{ action: this._editNotebookJobAction }
		]);
	}

	public openNotebook(history: azdata.AgentNotebookHistoryInfo) {
		if (history.runStatus === 0) {
			return;
		}
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		this._jobManagementService.getMaterialziedNotebook(ownerUri, targetDatabase, history.materializedNotebookId).then(async (result) => {
			if (result) {
				let regex = /:|-/gi;
				let readableDataTimeStirng = history.runDate.replace(regex, '').replace(' ', '');
				let tempNotebookFileName = this._agentViewComponent.agentNotebookInfo.name + '_' + readableDataTimeStirng;
				await this._commandService.executeCommand('agent.openNotebookEditorFromJsonString', tempNotebookFileName, result.notebookMaterializedJson);
			}
		});
	}



	public historyFilter(histories: azdata.AgentNotebookHistoryInfo[], minTime: number, maxTime: number) {
		let resultHistory: azdata.AgentNotebookHistoryInfo[] = [];

		return resultHistory;
	}


	/** GETTERS  */

	public get showSteps(): boolean {
		return this._showSteps;
	}

	public get stepRows() {
		return this._stepRows;
	}

	public get ownerUri(): string {
		return this._commonService.connectionManagementService.connectionInfo.ownerUri;
	}

	public get serverName(): string {
		return this._serverName;
	}

	/** SETTERS */

	public set showSteps(value: boolean) {
		this._showSteps = value;
		this._cd.detectChanges();
	}
}

/** Filtering Pipe */
@Pipe({
	name: 'historyFilter'
})
export class NotebookHistoryFilterPipe implements PipeTransform {
	transform(histories: azdata.AgentNotebookHistoryInfo[], minTime: number, maxTime: number, jobType: number): azdata.AgentNotebookHistoryInfo[] {
		let resultHistory: azdata.AgentNotebookHistoryInfo[] = histories.filter(function (h) {
			let historyDateTime = (new Date().getTime() - new Date(h.runDate.replace('T', ' ')).getTime()) / 1000;
			if (historyDateTime >= minTime && historyDateTime <= maxTime) {
				return true;
			}
			return false;
		});
		return (resultHistory.length > 0) ? resultHistory : null;
	}
}
