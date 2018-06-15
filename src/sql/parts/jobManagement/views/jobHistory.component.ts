/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobHistory';
import 'vs/css!sql/media/icons/common-icons';
import { OnInit, OnChanges, Component, Inject, Input, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy, Injectable } from '@angular/core';
import * as sqlops from 'sqlops';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { RunJobAction, StopJobAction, NewStepAction } from 'sql/parts/jobManagement/views/jobActions';
import { JobCacheObject } from 'sql/parts/jobManagement/common/jobManagementService';
import { AgentJobUtilities } from '../common/agentJobUtilities';
import { PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { IJobManagementService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { JobHistoryController, JobHistoryDataSource,
	JobHistoryRenderer, JobHistoryFilter, JobHistoryModel, JobHistoryRow } from 'sql/parts/jobManagement/views/jobHistoryTree';
import { JobStepsViewComponent } from 'sql/parts/jobManagement/views/jobStepsView.component';
import { JobStepsViewRow } from './jobStepsViewTree';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { ITreeOptions } from 'vs/base/parts/tree/browser/tree';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';

export const DASHBOARD_SELECTOR: string = 'jobhistory-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobHistory.component.html')),
	changeDetection: ChangeDetectionStrategy.OnPush
})
@Injectable()
export class JobHistoryComponent extends Disposable implements OnInit {

	private _tree: Tree;
	private _treeController: JobHistoryController;
	private _treeDataSource: JobHistoryDataSource;
	private _treeRenderer: JobHistoryRenderer;
	private _treeFilter: JobHistoryFilter;
	private _actionBar: Taskbar;

	@ViewChild('table') private _tableContainer: ElementRef;
	@ViewChild('actionbarContainer') private _actionbarContainer: ElementRef;

	@Input() public agentJobInfo: sqlops.AgentJobInfo = undefined;
	@Input() public agentJobHistories: sqlops.AgentJobHistoryInfo[] = undefined;
	public agentJobHistoryInfo: sqlops.AgentJobHistoryInfo = undefined;

	private _isVisible: boolean = false;
	private _stepRows: JobStepsViewRow[] = [];
	private _showSteps: boolean = undefined;
	private _showPreviousRuns: boolean = undefined;
	private _runStatus: string = undefined;
	private _jobCacheObject: JobCacheObject;
	private _agentJobInfo: sqlops.AgentJobInfo;
	private _noJobsAvailable: boolean = false;

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(INotificationService) private _notificationService: INotificationService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService
	) {
		super();
		this._treeController = new JobHistoryController();
		this._treeDataSource = new JobHistoryDataSource();
		this._treeRenderer = new JobHistoryRenderer();
		this._treeFilter =  new JobHistoryFilter();
		let jobCacheObjectMap = this._jobManagementService.jobCacheObjectMap;
		let serverName = _dashboardService.connectionManagementService.connectionInfo.connectionProfile.serverName;
		let jobCache = jobCacheObjectMap[serverName];
		if (jobCache) {
			this._jobCacheObject = jobCache;
		} else {
			this._jobCacheObject = new JobCacheObject();
			this._jobCacheObject.serverName = serverName;
			this._jobManagementService.addToCache(serverName, this._jobCacheObject);
		}
	}

	ngOnInit() {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
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
				self.setStepsTree(element);
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
		}, {verticalScrollMode: ScrollbarVisibility.Visible});
		this._register(attachListStyler(this._tree, this.themeService));
		this._tree.layout(1024);
		this._initActionBar();
	}

	ngAfterContentChecked() {
		this._agentJobInfo = this._agentViewComponent.agentJobInfo;
		if (!this.agentJobInfo) {
			this.agentJobInfo = this._agentJobInfo;
			this.setActions();
		}
		if (this._isVisible === false && this._tableContainer.nativeElement.offsetParent !== null) {
			this._isVisible = true;
			let jobHistories = this._jobCacheObject.jobHistories[this._agentViewComponent.jobId];
			if (jobHistories && jobHistories.length > 0) {
				const self = this;
				if (this._jobCacheObject.prevJobID === this._agentViewComponent.jobId || jobHistories[0].jobId === this._agentViewComponent.jobId) {
					this._showPreviousRuns = true;
					this.buildHistoryTree(self, jobHistories);
					$('jobhistory-component .history-details .prev-run-list .monaco-tree').attr('tabIndex', '-1');
					$('jobhistory-component .history-details .prev-run-list .monaco-tree-row').attr('tabIndex', '0');
					this._cd.detectChanges();
				}
			} else if (jobHistories && jobHistories.length === 0 ){
				this._showPreviousRuns = false;
				this._showSteps = false;
				this._noJobsAvailable = true;
				this._cd.detectChanges();
			} else {
				this.loadHistory();
			}
			this._jobCacheObject.prevJobID = this._agentViewComponent.jobId;
		} else if (this._isVisible === true && this._agentViewComponent.refresh) {
			this.loadHistory();
			this._agentViewComponent.refresh = false;
		} else if (this._isVisible === true && this._tableContainer.nativeElement.offsetParent === null) {
			this._isVisible = false;
		}
	}

	private loadHistory() {
		const self = this;
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.getJobHistory(ownerUri, this._agentViewComponent.jobId).then((result) => {
			if (result && result.jobs) {
				if (result.jobs.length > 0) {
					self._showPreviousRuns = true;
					self.buildHistoryTree(self, result.jobs);
					if (self._agentViewComponent.showHistory) {
						self._cd.detectChanges();
					}
				} else {
					self._jobCacheObject.setJobHistory(self._agentViewComponent.jobId, result.jobs);
					self._showPreviousRuns = false;
				}
			} else {
				self._showPreviousRuns = false;
				self._showSteps = false;
				self._cd.detectChanges();
			}
		});
	}

	private setStepsTree(element: any) {
		const self = this;
		self.agentJobHistoryInfo = self._treeController.jobHistories.find(
			history => self.formatTime(history.runDate) === self.formatTime(element.runDate));
		if (self.agentJobHistoryInfo) {
			self.agentJobHistoryInfo.runDate = self.formatTime(self.agentJobHistoryInfo.runDate);
			if (self.agentJobHistoryInfo.steps) {
				self._stepRows = self.agentJobHistoryInfo.steps.map(step => {
					let stepViewRow = new JobStepsViewRow();
					stepViewRow.message = step.message;
					stepViewRow.runStatus = AgentJobUtilities.convertToStatusString(step.runStatus);
					self._runStatus = AgentJobUtilities.convertToStatusString(self.agentJobHistoryInfo.runStatus);
					stepViewRow.stepName = step.stepName;
					stepViewRow.stepID = step.stepId.toString();
					return stepViewRow;
				});
				this._showSteps = self._stepRows.length > 0;
			} else {
				this._showSteps = false;
			}
			self._cd.detectChanges();
		}
	}

	private buildHistoryTree(self: any, jobHistories: sqlops.AgentJobHistoryInfo[]) {
		self._treeController.jobHistories = jobHistories;
		self._jobCacheObject.setJobHistory(self._agentViewComponent.jobId, jobHistories);
		let jobHistoryRows = this._treeController.jobHistories.map(job => self.convertToJobHistoryRow(job));
		self._treeDataSource.data = jobHistoryRows;
		self._tree.setInput(new JobHistoryModel());
		self.agentJobHistoryInfo = self._treeController.jobHistories[0];
		if (self.agentJobHistoryInfo) {
			self.agentJobHistoryInfo.runDate = self.formatTime(self.agentJobHistoryInfo.runDate);
		}
	}

	private toggleCollapse(): void {
		let arrow: HTMLElement = $('.resultsViewCollapsible').get(0);
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

	private convertToJobHistoryRow(historyInfo: sqlops.AgentJobHistoryInfo): JobHistoryRow {
		let jobHistoryRow = new JobHistoryRow();
		jobHistoryRow.runDate = this.formatTime(historyInfo.runDate);
		jobHistoryRow.runStatus = AgentJobUtilities.convertToStatusString(historyInfo.runStatus);
		jobHistoryRow.instanceID = historyInfo.instanceId;
		return jobHistoryRow;
	}

	private formatTime(time: string): string {
		return time.replace('T', ' ');
	}

	private showProgressWheel(): boolean {
		return this._showPreviousRuns !== true && this._noJobsAvailable === false;
	}

	private setActions(): void {
		let startIcon: HTMLElement = $('.action-label.icon.runJobIcon').get(0);
		let stopIcon: HTMLElement = $('.action-label.icon.stopJobIcon').get(0);
		AgentJobUtilities.getActionIconClassName(startIcon, stopIcon, this.agentJobInfo.currentExecutionStatus);
	}


	private _initActionBar() {
		let runJobAction = this.instantiationService.createInstance(RunJobAction);
		let stopJobAction = this.instantiationService.createInstance(StopJobAction);
		let newStepAction = this.instantiationService.createInstance(NewStepAction);
		let taskbar = <HTMLElement>this._actionbarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar, this.contextMenuService);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: runJobAction },
			{ action: stopJobAction },
			{ action: newStepAction }
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
		return this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
	}

	/** SETTERS */

	public set showSteps(value: boolean) {
		this._showSteps = value;
		this._cd.detectChanges();
	}
}
