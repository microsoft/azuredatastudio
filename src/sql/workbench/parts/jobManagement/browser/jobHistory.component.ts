/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/jobHistory';

import * as azdata from 'azdata';
import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { OnInit, Component, Inject, Input, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy, Injectable } from '@angular/core';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { AgentViewComponent } from 'sql/workbench/parts/jobManagement/browser/agentView.component';
import { CommonServiceInterface } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { RunJobAction, StopJobAction, EditJobAction, JobsRefreshAction } from 'sql/platform/jobManagement/browser/jobActions';
import { JobCacheObject } from 'sql/platform/jobManagement/common/jobManagementService';
import { JobManagementUtilities } from 'sql/platform/jobManagement/browser/jobManagementUtilities';
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
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

export const DASHBOARD_SELECTOR: string = 'jobhistory-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobHistory.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => JobHistoryComponent) }],
	changeDetection: ChangeDetectionStrategy.OnPush
})
@Injectable()
export class JobHistoryComponent extends JobManagementView implements OnInit {

	private _tree: Tree;
	private _treeController: JobHistoryController;
	private _treeDataSource: JobHistoryDataSource;
	private _treeRenderer: JobHistoryRenderer;
	private _treeFilter: JobHistoryFilter;

	@ViewChild('table') private _tableContainer: ElementRef;
	@ViewChild('jobsteps') private _jobStepsView: ElementRef;

	@Input() public agentJobInfo: azdata.AgentJobInfo = undefined;
	@Input() public agentJobHistories: azdata.AgentJobHistoryInfo[] = undefined;
	public agentJobHistoryInfo: azdata.AgentJobHistoryInfo = undefined;

	private _isVisible: boolean = false;
	private _stepRows: JobStepsViewRow[] = [];
	private _showSteps: boolean = undefined;
	private _showPreviousRuns: boolean = undefined;
	private _runStatus: string = undefined;
	private _jobCacheObject: JobCacheObject;
	private _agentJobInfo: azdata.AgentJobInfo;
	private _noJobsAvailable: boolean = false;

	// Job Actions
	private _editJobAction: EditJobAction;
	private _runJobAction: RunJobAction;
	private _stopJobAction: StopJobAction;
	private _refreshAction: JobsRefreshAction;

	private static readonly HEADING_HEIGHT: number = 24;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => AgentViewComponent)) _agentViewComponent: AgentViewComponent,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) dashboardService: IDashboardService,
		@Inject(ITelemetryService) private _telemetryService: ITelemetryService
	) {
		super(commonService, dashboardService, contextMenuService, keybindingService, instantiationService, _agentViewComponent);
		this._treeController = new JobHistoryController();
		this._treeDataSource = new JobHistoryDataSource();
		this._treeRenderer = new JobHistoryRenderer();
		this._treeFilter = new JobHistoryFilter();
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
	}

	ngOnInit() {
		// set base class elements
		this._visibilityElement = this._tableContainer;
		this._parentComponent = this._agentViewComponent;
		this._agentJobInfo = this._agentViewComponent.agentJobInfo;
		this.initActionBar();
		const self = this;
		this._treeController.onClick = (tree, element, event, origin = 'mouse') => {
			const payload = { origin: origin };
			const isDoubleClick = (origin === 'mouse' && event.detail === 2);
			// Cancel Event
			const isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';
			if (!isMouseDown) {
				event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
			}
			event.stopPropagation();
			tree.setFocus(element, payload);
			if (element && isDoubleClick) {
				event.preventDefault(); // focus moves to editor, we need to prevent default
			} else {
				tree.setFocus(element, payload);
				tree.setSelection([element], payload);
				if (element.rowID) {
					self.setStepsTree(element);
				} else {
					event.preventDefault();
				}
			}
			return true;
		};
		this._treeController.onKeyDown = (tree, event) => {
			this._treeController.onKeyDownWrapper(tree, event);
			let element = tree.getFocus();
			if (element) {
				self.setStepsTree(element);
			}
			return true;
		};
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		}, { verticalScrollMode: ScrollbarVisibility.Visible });
		this._register(attachListStyler(this._tree, this.themeService));
		this._tree.layout(dom.getContentHeight(this._tableContainer.nativeElement));
		this._telemetryService.publicLog(TelemetryKeys.JobHistoryView);
	}

	private loadHistory() {
		const self = this;
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let jobName = this._agentViewComponent.agentJobInfo.name;
		let jobId = this._agentViewComponent.jobId;
		this._jobManagementService.getJobHistory(ownerUri, jobId, jobName).then((result) => {
			if (result && result.histories) {
				self._jobCacheObject.setJobHistory(jobId, result.histories);
				self._jobCacheObject.setJobAlerts(jobId, result.alerts);
				self._jobCacheObject.setJobSchedules(jobId, result.schedules);
				self._jobCacheObject.setJobSteps(jobId, result.steps);
				this._agentViewComponent.agentJobInfo.jobSteps = this._jobCacheObject.getJobSteps(jobId);
				this._agentViewComponent.agentJobInfo.jobSchedules = this._jobCacheObject.getJobSchedules(jobId);
				this._agentViewComponent.agentJobInfo.alerts = this._jobCacheObject.getJobAlerts(jobId);
				this._agentJobInfo = this._agentViewComponent.agentJobInfo;
				if (result.histories.length > 0) {
					self._noJobsAvailable = false;
					self._showPreviousRuns = true;
					self.buildHistoryTree(self, result.histories);
				} else {
					self._jobCacheObject.setJobHistory(self._agentViewComponent.jobId, result.histories);
					self._noJobsAvailable = true;
					self._showPreviousRuns = false;
				}
			} else {
				self._noJobsAvailable = true;
				self._showPreviousRuns = false;
				self._showSteps = false;
			}
			this._actionBar.context = { targetObject: { canEdit: true, job: this._agentJobInfo }, ownerUri: this.ownerUri, component: this };
			this._editJobAction.enabled = true;
			this._actionBar.setContent([
				{ action: this._runJobAction },
				{ action: this._stopJobAction },
				{ action: this._refreshAction },
				{ action: this._editJobAction }
			]);
			if (self._agentViewComponent.showHistory) {
				self._cd.detectChanges();
			}
		});
	}

	private setStepsTree(element: JobHistoryRow) {
		const self = this;
		let cachedHistory = self._jobCacheObject.getJobHistory(element.jobID);
		if (cachedHistory) {
			self.agentJobHistoryInfo = cachedHistory.find(
				history => self.formatTime(history.runDate) === self.formatTime(element.runDate));
		} else {
			self.agentJobHistoryInfo = self._treeController.jobHistories.find(
				history => self.formatTime(history.runDate) === self.formatTime(element.runDate));
		}
		if (self.agentJobHistoryInfo) {
			self.agentJobHistoryInfo.runDate = self.formatTime(self.agentJobHistoryInfo.runDate);
			if (self.agentJobHistoryInfo.steps) {
				let jobStepStatus = this.didJobFail(self.agentJobHistoryInfo);
				self._stepRows = self.agentJobHistoryInfo.steps.map(step => {
					let stepViewRow = new JobStepsViewRow();
					stepViewRow.message = step.message;
					stepViewRow.runStatus = jobStepStatus ? JobManagementUtilities.convertToStatusString(0) :
						JobManagementUtilities.convertToStatusString(step.runStatus);
					self._runStatus = JobManagementUtilities.convertToStatusString(self.agentJobHistoryInfo.runStatus);
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
			if (self._agentViewComponent.showHistory) {
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

	private buildHistoryTree(self: any, jobHistories: azdata.AgentJobHistoryInfo[]) {
		self._treeController.jobHistories = jobHistories;
		let jobHistoryRows: JobHistoryRow[] = this._treeController.jobHistories.map(job => self.convertToJobHistoryRow(job));
		let sortedRows = jobHistoryRows.sort((row1, row2) => {
			let date1 = new Date(row1.runDate).getTime();
			let date2 = new Date(row2.runDate).getTime();
			return date2 - date1;
		});
		self._treeDataSource.data = sortedRows;
		self._tree.setInput(new JobHistoryModel());
		self.agentJobHistoryInfo = self._treeController.jobHistories[0];
		if (self.agentJobHistoryInfo) {
			self.agentJobHistoryInfo.runDate = self.formatTime(self.agentJobHistoryInfo.runDate);
		}
		const payload = { origin: 'origin' };
		let element = this._treeDataSource.getFirstElement();
		this._tree.setFocus(element, payload);
		this._tree.setSelection([element], payload);
		if (element.rowID) {
			self.setStepsTree(element);
		}
	}

	private toggleCollapse(): void {
		let arrow: HTMLElement = jQuery('.resultsViewCollapsible').get(0);
		let checkbox: any = document.getElementById('accordion');
		if (arrow.className === 'resultsViewCollapsible' && checkbox.checked === false) {
			arrow.className = 'resultsViewCollapsible collapsed';
		} else if (arrow.className === 'resultsViewCollapsible collapsed' && checkbox.checked === true) {
			arrow.className = 'resultsViewCollapsible';
		}
	}

	private goToJobs(): void {
		this._isVisible = false;
		this._agentViewComponent.showHistory = false;
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

		let jobHistories = this._jobCacheObject.jobHistories[this._agentViewComponent.jobId];
		if (jobHistories) {
			if (jobHistories.length > 0) {
				const self = this;
				this._noJobsAvailable = false;
				if (this._jobCacheObject.prevJobID === this._agentViewComponent.jobId || jobHistories[0].jobId === this._agentViewComponent.jobId) {
					this._showPreviousRuns = true;
					this._agentViewComponent.agentJobInfo.jobSteps = this._jobCacheObject.getJobSteps(this._agentJobInfo.jobId);
					this._agentViewComponent.agentJobInfo.jobSchedules = this._jobCacheObject.getJobSchedules(this._agentJobInfo.jobId);
					this._agentViewComponent.agentJobInfo.alerts = this._jobCacheObject.getJobAlerts(this._agentJobInfo.jobId);
					this._agentJobInfo = this._agentViewComponent.agentJobInfo;
					this.buildHistoryTree(self, jobHistories);
				}
			} else if (jobHistories.length === 0) {
				this._showPreviousRuns = false;
				this._showSteps = false;
				this._noJobsAvailable = true;
			}
			this._editJobAction.enabled = true;
			this._actionBar.setContent([
				{ action: this._runJobAction },
				{ action: this._stopJobAction },
				{ action: this._refreshAction },
				{ action: this._editJobAction }
			]);
			this._cd.detectChanges();

		} else {
			this.loadHistory();
		}
		this._jobCacheObject.prevJobID = this._agentViewComponent.jobId;
	}

	public layout() {
		let historyDetails = jQuery('.overview-container').get(0);
		let statusBar = jQuery('.part.statusbar').get(0);
		if (historyDetails && statusBar) {
			let historyBottom = historyDetails.getBoundingClientRect().bottom;
			let statusTop = statusBar.getBoundingClientRect().top;

			let height: number = statusTop - historyBottom - JobHistoryComponent.HEADING_HEIGHT;

			if (this._table) {
				this._table.layout(new dom.Dimension(
					dom.getContentWidth(this._tableContainer.nativeElement),
					height));
			}

			if (this._tree) {
				this._tree.layout(dom.getContentHeight(this._tableContainer.nativeElement));
			}
		}
	}

	protected initActionBar() {
		this._runJobAction = this.instantiationService.createInstance(RunJobAction);
		this._stopJobAction = this.instantiationService.createInstance(StopJobAction);
		this._editJobAction = this.instantiationService.createInstance(EditJobAction);
		this._refreshAction = this.instantiationService.createInstance(JobsRefreshAction);
		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._editJobAction.enabled = !this.showProgressWheel();
		let targetObject: JobActionContext = { canEdit: !this.showProgressWheel(), job: this._agentJobInfo };
		this._actionBar.context = { targetObject: targetObject, ownerUri: this.ownerUri, component: this };
		this._actionBar.setContent([
			{ action: this._runJobAction },
			{ action: this._stopJobAction },
			{ action: this._refreshAction },
			{ action: this._editJobAction }
		]);
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
