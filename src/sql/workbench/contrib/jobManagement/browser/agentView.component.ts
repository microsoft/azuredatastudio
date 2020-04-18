/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/jobs';

import * as nls from 'vs/nls';
import { Component, Inject, forwardRef, ChangeDetectorRef, ViewChild, Injectable } from '@angular/core';
import { AgentJobInfo, AgentNotebookInfo } from 'azdata';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { IJobManagementService } from 'sql/workbench/services/jobManagement/common/interfaces';


export const DASHBOARD_SELECTOR: string = 'agentview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./agentView.component.html'))
})
@Injectable()
export class AgentViewComponent {

	@ViewChild(PanelComponent) private _panel: PanelComponent;

	private _showHistory: boolean = false;
	private _showNotebookHistory: boolean = false;
	private _jobId: string = null;
	private _notebookId: string = null;
	private _agentJobInfo: AgentJobInfo = null;
	private _agentNotebookInfo: AgentNotebookInfo = null;
	private _refresh: boolean = undefined;
	private _expanded: Map<string, string>;
	private _expandedNotebook: Map<string, string>;

	public jobsIconClass: string = 'jobsview-icon';
	public notebooksIconClass: string = 'notebooksview-icon';
	public alertsIconClass: string = 'alertsview-icon';
	public proxiesIconClass: string = 'proxiesview-icon';
	public operatorsIconClass: string = 'operatorsview-icon';

	public readonly jobsComponentTitle: string = nls.localize('jobview.Jobs', "Jobs");
	public readonly notebooksComponentTitle: string = nls.localize('jobview.Notebooks', "Notebooks");
	public readonly alertsComponentTitle: string = nls.localize('jobview.Alerts', "Alerts");
	public readonly proxiesComponentTitle: string = nls.localize('jobview.Proxies', "Proxies");
	public readonly operatorsComponentTitle: string = nls.localize('jobview.Operators', "Operators");

	public readonly panelOpt: IPanelOptions = {
		alwaysShowTabs: true,
		layout: NavigationBarLayout.horizontal,
		showIcon: true
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(IJobManagementService) jobManagementService: IJobManagementService) {
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

	public get notebookId(): string {
		return this._notebookId;
	}

	public get showHistory(): boolean {
		return this._showHistory;
	}

	public get showNotebookHistory(): boolean {
		return this._showNotebookHistory;
	}

	public get agentJobInfo(): AgentJobInfo {
		return this._agentJobInfo;
	}

	public get agentNotebookInfo(): AgentNotebookInfo {
		return this._agentNotebookInfo;
	}

	public get refresh(): boolean {
		return this._refresh;
	}

	public get expanded(): Map<string, string> {
		return this._expanded;
	}

	public get expandedNotebook(): Map<string, string> {
		return this._expandedNotebook;
	}

	/**
	 * Public Setters
	 */

	public set jobId(value: string) {
		this._jobId = value;
	}

	public set notebookId(value: string) {
		this._notebookId = value;
	}

	public set showHistory(value: boolean) {
		this._showHistory = value;
		this._cd.detectChanges();
	}

	public set showNotebookHistory(value: boolean) {
		this._showNotebookHistory = value;
		this._cd.detectChanges();
	}

	public set agentJobInfo(value: AgentJobInfo) {
		this._agentJobInfo = value;
	}

	public set agentNotebookInfo(value: AgentNotebookInfo) {
		this._agentNotebookInfo = value;
	}

	public set refresh(value: boolean) {
		this._refresh = value;
		this._cd.detectChanges();
	}

	public setExpanded(jobId: string, errorMessage: string) {
		this._expanded.set(jobId, errorMessage);
	}

	public setExpandedNotebook(jobId: string, errorMessage: string) {
		this._expandedNotebook.set(jobId, errorMessage);
	}

	public set expanded(value: Map<string, string>) {
		this._expanded = value;
	}

	public set expandedNotebook(value: Map<string, string>) {
		this._expandedNotebook = value;
	}

	public layout() {
		this._panel.layout();
	}
}
