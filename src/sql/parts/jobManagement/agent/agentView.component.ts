/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../common/media/jobs';
import 'sql/parts/dashboard/common/dashboardPanelStyles';

import * as nls from 'vs/nls';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, Injectable } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { AgentJobInfo, AgentJobHistoryInfo } from 'sqlops';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';


export const DASHBOARD_SELECTOR: string = 'agentview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./agentView.component.html'))
})
@Injectable()
export class AgentViewComponent {

	@ViewChild(PanelComponent) private _panel: PanelComponent;

	// tslint:disable:no-unused-variable
	private readonly jobsComponentTitle: string = nls.localize('jobview.Jobs', "Jobs");
	private _showHistory: boolean = false;
	private _jobId: string = null;
	private _agentJobInfo: AgentJobInfo = null;
	private _refresh: boolean = undefined;
	private _expanded: Map<string, string>;

	public jobsIconClass: string = 'jobsview-icon';

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		showTabsWhenOne: true,
		layout: NavigationBarLayout.vertical,
		showIcon: true
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef) {
		this._expanded = new Map<string, string>();
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
