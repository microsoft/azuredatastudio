/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../common/media/jobs';
import 'sql/parts/dashboard/common/dashboardPanelStyles';

import * as nls from 'vs/nls';
import { Component, Inject, forwardRef, ChangeDetectorRef, ViewChild, Injectable } from '@angular/core';
import { AgentJobInfo } from 'sqlops';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';


export const DASHBOARD_SELECTOR: string = 'agentview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./agentView.component.html'))
})
@Injectable()
export class AgentViewComponent {

	@ViewChild(PanelComponent) private _panel: PanelComponent;

	private _showHistory: boolean = false;
	private _jobId: string = null;
	private _agentJobInfo: AgentJobInfo = null;
	private _refresh: boolean = undefined;
	private _expanded: Map<string, string>;

	public jobsIconClass: string = 'jobsview-icon';
	public alertsIconClass: string = 'alertsview-icon';
	public proxiesIconClass: string = 'proxiesview-icon';
	public operatorsIconClass: string = 'operatorsview-icon';

	private readonly jobsComponentTitle: string = nls.localize('jobview.Jobs', "Jobs");
	private readonly alertsComponentTitle: string = nls.localize('jobview.Alerts', "Alerts");
	private readonly proxiesComponentTitle: string = nls.localize('jobview.Proxies', "Proxies");
	private readonly operatorsComponentTitle: string = nls.localize('jobview.Operators', "Operators");

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		showTabsWhenOne: true,
		layout: NavigationBarLayout.vertical,
		showIcon: true
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(IJobManagementService) jobManagementService: IJobManagementService,
		@Inject(IDashboardService) dashboardService: IDashboardService, ) {
		this._expanded = new Map<string, string>();

		let self = this;
		jobManagementService.onDidChange((args) => {
			self.refresh = true;
			self._cd.detectChanges();
		});
	}

	/**
	 * Public Getters
	 */
	public get jobId(): string {
		return this._jobId;
	}

	public get showHistory(): boolean {
		return this._showHistory;
	}

	public get agentJobInfo(): AgentJobInfo {
		return this._agentJobInfo;
	}

	public get refresh(): boolean {
		return this._refresh;
	}

	public get expanded(): Map<string, string> {
		return this._expanded;
	}

	/**
	 * Public Setters
	 */

	public set jobId(value: string) {
		this._jobId = value;
	}

	public set showHistory(value: boolean) {
		this._showHistory = value;
		this._cd.detectChanges();
	}

	public set agentJobInfo(value: AgentJobInfo) {
		this._agentJobInfo = value;
	}

	public set refresh(value: boolean) {
		this._refresh = value;
		this._cd.detectChanges();
	}

	public setExpanded(jobId: string, errorMessage: string) {
		this._expanded.set(jobId, errorMessage);
	}

	public set expanded(value: Map<string, string>) {
		this._expanded = value;
	}

	public layout() {
		this._panel.layout();
	}
}
