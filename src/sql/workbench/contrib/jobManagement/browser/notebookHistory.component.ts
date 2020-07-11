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
import { AgentViewComponent } from 'sql/workbench/contrib/jobManagement/browser/agentView.component';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { RunJobAction, StopJobAction, JobsRefreshAction, EditNotebookJobAction, OpenMaterializedNotebookAction, OpenTemplateNotebookAction, RenameNotebookMaterializedAction, PinNotebookMaterializedAction, UnpinNotebookMaterializedAction, DeleteMaterializedNotebookAction } from 'sql/workbench/contrib/jobManagement/browser/jobActions';
import { NotebookCacheObject } from 'sql/workbench/services/jobManagement/common/jobManagementService';
import { IJobManagementService } from 'sql/workbench/services/jobManagement/common/interfaces';
import { JobStepsViewRow } from 'sql/workbench/contrib/jobManagement/browser/jobStepsViewTree';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAction } from 'vs/base/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { JobManagementView, JobActionContext } from 'sql/workbench/contrib/jobManagement/browser/jobManagementView';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';

export const DASHBOARD_SELECTOR: string = 'notebookhistory-component';
export class GridSection {
	title: string;
	histories: azdata.AgentNotebookHistoryInfo[];
	contextMenuType: number;
	style: string;
}
@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebookHistory.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => NotebookHistoryComponent) }],
	changeDetection: ChangeDetectionStrategy.OnPush
})
@Injectable()
export class NotebookHistoryComponent extends JobManagementView implements OnInit {

	@ViewChild('table') private _tableContainer: ElementRef;

	@Input() public agentNotebookInfo: azdata.AgentNotebookInfo = undefined;
	@Input() public agentJobHistories: azdata.AgentJobHistoryInfo[] = undefined;
	public notebookHistories: azdata.AgentNotebookHistoryInfo[] = undefined;
	public agentNotebookHistoryInfo: azdata.AgentNotebookHistoryInfo = undefined;

	private _stepRows: JobStepsViewRow[] = [];
	private _showSteps: boolean = undefined;
	private _showPreviousRuns: boolean = undefined;
	private _notebookCacheObject: NotebookCacheObject;
	private _agentNotebookInfo: azdata.AgentNotebookInfo;
	private _noJobsAvailable: boolean = false;
	protected _notebookHistoryActionBar: Taskbar;

	// Job Actions
	private _editNotebookJobAction: EditNotebookJobAction;
	private _runJobAction: RunJobAction;
	private _stopJobAction: StopJobAction;
	private _refreshAction: JobsRefreshAction;
	private _openNotebookTemplateAction: OpenTemplateNotebookAction;

	private static readonly HEADING_HEIGHT: number = 24;

	private _grids: GridSection[] = [];



	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => AgentViewComponent)) _agentViewComponent: AgentViewComponent,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) dashboardService: IDashboardService,
		@Inject(ITelemetryService) private _telemetryService: ITelemetryService,
		@Inject(IQuickInputService) private _quickInputService: IQuickInputService
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
		this._agentNotebookInfo = this._agentViewComponent.agentNotebookInfo;
		this.initActionBar();
		this._telemetryService.publicLog(TelemetryKeys.JobHistoryView);
	}

	private loadHistory() {
		const self = this;
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let jobName = this._agentViewComponent.agentNotebookInfo.name;
		let jobId = this._agentViewComponent.notebookId;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		this._jobManagementService.getNotebookHistory(ownerUri, jobId, jobName, targetDatabase).then((result) => {
			if (result && result.histories) {
				this.notebookHistories = result.histories;
				self._notebookCacheObject.setNotebookHistory(jobId, this.notebookHistories);
				self._notebookCacheObject.setJobSchedules(jobId, result.schedules);
				self._notebookCacheObject.setJobSteps(jobId, result.steps);
				this._agentViewComponent.agentNotebookInfo.jobSteps = this._notebookCacheObject.getJobSteps(jobId);
				this._agentViewComponent.agentNotebookInfo.jobSchedules = this._notebookCacheObject.getJobSchedules(jobId);
				this._agentNotebookInfo = this._agentViewComponent.agentNotebookInfo;
				if (result.histories.length > 0) {
					self._noJobsAvailable = false;
					self._showPreviousRuns = true;
				} else {
					self._notebookCacheObject.setNotebookHistory(self._agentViewComponent.notebookId, result.histories);
					self._noJobsAvailable = true;
					self._showPreviousRuns = false;
				}
			} else {
				self._noJobsAvailable = true;
				self._showPreviousRuns = false;
				self._showSteps = false;
			}
			this._actionBar.context = { targetObject: { canEdit: true, notebook: this._agentNotebookInfo, job: this._agentNotebookInfo }, ownerUri: this.ownerUri, component: this };
			this._editNotebookJobAction.enabled = true;
			this._actionBar.setContent([
				{ action: this._runJobAction },
				{ action: this._stopJobAction },
				{ action: this._refreshAction },
				{ action: this._editNotebookJobAction },
				{ action: this._openNotebookTemplateAction }
			]);

			this.createGrid();
			if (self._agentViewComponent.showNotebookHistory) {
				self._cd.detectChanges();
				this.collapseGrid();
			}
		});
	}

	public toggleCollapse(): void {
		let arrow: HTMLElement = jQuery('.resultsViewCollapsible').get(0);
		let checkbox: any = document.getElementById('accordion');
		if (arrow.className === 'resultsViewCollapsible' && checkbox.checked === false) {
			arrow.className = 'resultsViewCollapsible collapsed';
		} else if (arrow.className === 'resultsViewCollapsible collapsed' && checkbox.checked === true) {
			arrow.className = 'resultsViewCollapsible';
		}

	}

	public toggleGridCollapse(i): void {
		let notebookGrid = document.getElementById('notebook-grid' + i);
		let checkbox: any = document.getElementById('accordion' + i);
		let arrow = document.getElementById('history-grid-icon' + i);
		if (notebookGrid.className === 'notebook-grid ' + i && checkbox.checked === true) {
			notebookGrid.className = 'notebook-grid ' + i + ' collapsed';
			notebookGrid.style.display = 'none';
			arrow.className = 'resultsViewCollapsible collapsed';
		} else if (notebookGrid.className === 'notebook-grid ' + i + ' collapsed' && checkbox.checked === false) {
			notebookGrid.className = 'notebook-grid ' + i;
			notebookGrid.style.display = 'grid';
			arrow.className = 'resultsViewCollapsible';
		}

	}

	public goToJobs(): void {
		this._agentViewComponent.showNotebookHistory = false;
	}

	public formatDateTimetoLocaleDate(time: string) {
		let dateInstance = new Date(time);
		return dateInstance.toLocaleDateString();
	}

	public formatDateTimetoLocaleTime(time: string) {
		let dateInstance = new Date(time);
		return dateInstance.toLocaleTimeString();
	}


	private showProgressWheel(): boolean {
		return this._showPreviousRuns !== true && this._noJobsAvailable === false;
	}

	public onFirstVisible() {
		this._agentNotebookInfo = this._agentViewComponent.agentNotebookInfo;

		if (!this.agentNotebookInfo) {
			this.agentNotebookInfo = this._agentNotebookInfo;
		}

		if (this.isRefreshing) {
			this.loadHistory();
			return;
		}
		else {
			this.createGrid();
		}
		let notebookHistories = this._notebookCacheObject.notebookHistories[this._agentViewComponent.notebookId];
		if (notebookHistories) {
			if (notebookHistories.length > 0) {
				this._noJobsAvailable = false;
				if (this._notebookCacheObject.prevJobID === this._agentViewComponent.notebookId || notebookHistories[0].jobId === this._agentViewComponent.notebookId) {
					this._showPreviousRuns = true;
					this._agentViewComponent.agentNotebookInfo.jobSteps = this._notebookCacheObject.getJobSteps(this._agentNotebookInfo.jobId);
					this._agentViewComponent.agentNotebookInfo.jobSchedules = this._notebookCacheObject.getJobSchedules(this._agentNotebookInfo.jobId);
					this._agentNotebookInfo = this._agentViewComponent.agentNotebookInfo;
				}
			} else if (notebookHistories.length === 0) {
				this._showPreviousRuns = false;
				this._showSteps = false;
				this._noJobsAvailable = true;
			}
			this._editNotebookJobAction.enabled = true;
			this._actionBar.setContent([
				{ action: this._runJobAction },
				{ action: this._stopJobAction },
				{ action: this._refreshAction },
				{ action: this._editNotebookJobAction },
				{ action: this._openNotebookTemplateAction }
			]);
			this._cd.detectChanges();
			this.collapseGrid();
		} else {
			this.loadHistory();
		}
		this._notebookCacheObject.prevJobID = this._agentViewComponent.notebookId;

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
		this._openNotebookTemplateAction = this.instantiationService.createInstance(OpenTemplateNotebookAction);
		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._editNotebookJobAction.enabled = !this.showProgressWheel();
		let targetObject: JobActionContext = { canEdit: !this.showProgressWheel(), job: this._agentNotebookInfo };
		this._actionBar.context = { targetObject: targetObject, ownerUri: this.ownerUri, component: this };
		this._actionBar.setContent([
			{ action: this._runJobAction },
			{ action: this._stopJobAction },
			{ action: this._refreshAction },
			{ action: this._editNotebookJobAction },
			{ action: this._openNotebookTemplateAction }
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
				let readableDataTimeString = history.runDate.replace(regex, '').replace(' ', '');
				let tempNotebookFileName = this._agentViewComponent.agentNotebookInfo.name + '_' + readableDataTimeString;
				await this._commandService.executeCommand('agent.openNotebookEditorFromJsonString', tempNotebookFileName, result.notebookMaterialized);
			}
		});
	}

	public deleteMaterializedNotebook(history: azdata.AgentNotebookHistoryInfo) {
		//TODO: Implement deletenotebook context menu action
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		this._jobManagementService.deleteMaterializedNotebook(ownerUri, history, targetDatabase).then(async (result) => {
			if (result) {
				this.loadHistory();
			}
		});
	}

	public openTemplateNotebook() {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		let jobId = this._agentViewComponent.agentNotebookInfo.jobId;

		this._jobManagementService.getTemplateNotebook(ownerUri, targetDatabase, jobId).then(async (result) => {
			if (result) {
				await this._commandService.executeCommand('agent.openNotebookEditorFromJsonString', this._agentViewComponent.agentNotebookInfo.name, result.notebookTemplate, this.agentNotebookInfo, ownerUri);
			}
		});
	}

	public renameNotebook(history: azdata.AgentNotebookHistoryInfo) {
		const defaultDateTime = new Date(history.runDate).toLocaleDateString() + ' ' + new Date(history.runDate).toLocaleTimeString();
		let notebookRunName = (history.materializedNotebookName === '') ? defaultDateTime : history.materializedNotebookName;
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		this._quickInputService.input({ placeHolder: notebookRunName }).then(async (value) => {
			if (value) {
				if (!/\S/.test(value)) {
					value = '';
				}
				await this._jobManagementService.updateNotebookMaterializedName(ownerUri, history, targetDatabase, value).then(async (result) => {
					if (result) {
						history.materializedNotebookName = value;
						this.loadHistory();

					}
				});
			}
		});
	}

	public toggleNotebookPin(history: azdata.AgentNotebookHistoryInfo, pin: boolean) {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		let targetDatabase = this._agentViewComponent.agentNotebookInfo.targetDatabase;
		this._jobManagementService.updateNotebookMaterializedPin(ownerUri, history, targetDatabase, pin).then(async (result) => {
			if (result) {
				history.materializedNotebookPin = pin;
				this.loadHistory();
			}

		});
	}

	public openHistoryContextMenu(event: MouseEvent, history: azdata.AgentNotebookHistoryInfo, contextMenuType: number) {
		let anchor = {
			x: event.clientX,
			y: event.clientY
		};
		let actionContext = {
			component: this,
			history: history
		};
		this._contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => (contextMenuType === 1) ? this.getPinnedGridActions() : this.getGridActions(),
			getKeyBinding: (action) => this._keybindingFor(action),
			getActionsContext: () => (actionContext)
		});
	}

	protected getGridActions(): IAction[] {
		const openNotebookAction = this._instantiationService.createInstance(OpenMaterializedNotebookAction);
		const renameNotebookAction = this._instantiationService.createInstance(RenameNotebookMaterializedAction);
		const pinNotebookAction = this._instantiationService.createInstance(PinNotebookMaterializedAction);
		const deleteMaterializedNotebookAction = this._instantiationService.createInstance(DeleteMaterializedNotebookAction);
		return [
			openNotebookAction,
			renameNotebookAction,
			pinNotebookAction,
			deleteMaterializedNotebookAction
		];
	}

	protected getPinnedGridActions(): IAction[] {
		const openNotebookAction = this._instantiationService.createInstance(OpenMaterializedNotebookAction);
		const renameNotebookAction = this._instantiationService.createInstance(RenameNotebookMaterializedAction);
		const unpinNotebookAction = this._instantiationService.createInstance(UnpinNotebookMaterializedAction);
		const deleteMaterializedNotebookAction = this._instantiationService.createInstance(DeleteMaterializedNotebookAction);
		return [
			openNotebookAction,
			renameNotebookAction,
			unpinNotebookAction,
			deleteMaterializedNotebookAction
		];
	}

	public createdTooltip(history: azdata.AgentNotebookHistoryInfo) {
		let tooltipString: string = '';
		if (history.materializedNotebookName && history.materializedNotebookName !== '') {
			tooltipString = history.materializedNotebookName;
		}
		let dateOptions = {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		};

		tooltipString += '\n' + nls.localize('notebookHistory.dateCreatedTooltip', "Date Created: ") + new Date(history.runDate).toLocaleDateString(undefined, dateOptions);
		if (history.materializedNotebookErrorInfo && /\S/.test(history.materializedNotebookErrorInfo)) {
			tooltipString += '\n' + nls.localize('notebookHistory.notebookErrorTooltip', "Notebook Error: ") + history.materializedNotebookErrorInfo;
		}
		if (history.runStatus === 0 && history.message && /\S/.test(history.message)) {
			tooltipString += '\n' + nls.localize('notebookHistory.ErrorTooltip', "Job Error: ") + history.message;
		}
		return tooltipString;
	}

	public createGrid() {
		let histories = this._notebookCacheObject.getNotebookHistory(this._agentViewComponent.notebookId);
		histories = histories.sort((h1, h2) => {
			return new Date(h2.runDate).getTime() - new Date(h1.runDate).getTime();
		});
		this._grids = [];
		let tempHistory: azdata.AgentNotebookHistoryInfo[] = [];
		for (let i = 0; i < histories.length; i++) {
			if (histories[i].materializedNotebookPin) {
				tempHistory.push(histories[i]);
			}
		}

		this._grids.push({
			title: nls.localize('notebookHistory.pinnedTitle', "Pinned"),
			histories: tempHistory,
			contextMenuType: 1,
			style: 'grid'
		});
		// Pushing the pinned notebooks grid
		tempHistory = [];
		let count = 0;
		let i = 0;
		for (; i < histories.length; i++) {
			if (!histories[i].materializedNotebookPin && count < 10) {
				tempHistory.push(histories[i]);
				count++;
			}
			if (count === 10) {
				break;
			}
		}
		this._grids.push({
			title: nls.localize('notebookHistory.recentRunsTitle', "Recent Runs"),
			histories: tempHistory,
			contextMenuType: 0,
			style: 'grid'
		});
		tempHistory = [];
		for (i += 1; i < histories.length; i++) {
			if (!histories[i].materializedNotebookPin) {
				tempHistory.push(histories[i]);
			}
		}
		this._grids.push({
			title: nls.localize('notebookHistory.pastRunsTitle', "Past Runs"),
			histories: tempHistory,
			contextMenuType: 0,
			style: 'none'
		});

	}

	public collapseGrid() {
		for (let i = 0; i < this._grids.length; i++) {
			let notebookGrid = document.getElementById('notebook-grid' + i);
			let arrow = document.getElementById('history-grid-icon' + i);
			if (notebookGrid) {
				let checkbox: any = document.getElementById('accordion' + i);
				if (this._grids[i].style === 'none') {
					notebookGrid.className = 'notebook-grid ' + i + ' collapsed';
					arrow.className = 'resultsViewCollapsible collapsed';
					notebookGrid.style.display = 'none';
					checkbox.checked = true;
				}
				else {
					notebookGrid.className = 'notebook-grid ' + i;
					notebookGrid.style.display = 'grid';
					arrow.className = 'resultsViewCollapsible';
					checkbox.checked = false;
				}
			}
		}
	}

	public refreshJobs() {
		this._agentViewComponent.refresh = true;
		this.loadHistory();
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
