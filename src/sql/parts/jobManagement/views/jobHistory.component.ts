/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobHistory';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, Input } from '@angular/core';
import { ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { getContentHeight } from 'vs/base/browser/dom';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IJobManagementService } from '../common/interfaces';
import { ExplorerDataSource } from 'sql/parts/dashboard/widgets/explorer/explorerTree';
import { TreeCreationUtils } from 'sql/parts/registeredServer/viewlet/treeCreationUtils';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { JobHistoryController, JobHistoryDataSource,
	JobHistoryRenderer, JobHistoryFilter, JobHistoryModel, JobHistoryRow } from 'sql/parts/jobManagement/views/jobHistoryTree';
import { AgentJobHistoryInfo, AgentJobInfo } from 'sqlops';
import { toDisposableSubscription } from '../../common/rxjsUtils';


export const DASHBOARD_SELECTOR: string = 'jobhistory-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobHistory.component.html'))
})
export class JobHistoryComponent extends Disposable implements OnInit, OnDestroy {

	private _jobManagementService: IJobManagementService;
	private _tree: Tree;
	private _treeController = new JobHistoryController();
	private _treeDataSource = new JobHistoryDataSource();
	private _treeRenderer = new JobHistoryRenderer();
	private _treeFilter =  new JobHistoryFilter();

	@ViewChild('table') private _tableContainer: ElementRef;

	@Input() public agentJobInfo: AgentJobInfo = undefined;
	@Input() public jobId: string = undefined;
	@Input() public agentJobHistoryInfo: AgentJobHistoryInfo = undefined;
	private prevJobId: string = undefined;

	private isVisible: boolean = false;


	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent
	) {
		super();
		this._jobManagementService = bootstrapService.jobManagementService;
	}

	ngOnInit() {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		});
		this.loadHistory();
		this._register(attachListStyler(this._tree, this.bootstrapService.themeService));
		this._tree.layout(1024);
	}

	ngOnDestroy() {
	}

	ngAfterContentChecked() {
		if (this.isVisible === false && this._tableContainer.nativeElement.offsetParent !== null) {
			if (this.prevJobId !== undefined && this.prevJobId !== this.jobId) {
				this.loadHistory();
				this.prevJobId = this.jobId;
			}
		}
	}

	loadHistory() {
		const self = this;
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.getJobHistory(ownerUri, this.jobId).then((result) => {
			if (result.jobs) {
				let jobHistory = result.jobs;
				let jobHistoryRows = jobHistory.map(job => self.convertToJobHistoryRow(job));
				self._treeDataSource.data = jobHistoryRows;
				self._tree.setInput(new JobHistoryModel());
			}
		});
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

	private jobAction(action: string, jobName): void {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.jobAction(ownerUri, jobName, action);
	}

	private goToJobs(): void {
		this._agentViewComponent.showHistory = false;
	}

	private convertToJobHistoryRow(historyInfo: AgentJobHistoryInfo): JobHistoryRow {
		let jobHistoryRow = new JobHistoryRow();
		jobHistoryRow.runDate = historyInfo.runDate;
		jobHistoryRow.runStatus = JobHistoryRow.convertToStatusString(historyInfo.runStatus)
		jobHistoryRow.jobID = historyInfo.jobID;
		return jobHistoryRow;
	}
}

