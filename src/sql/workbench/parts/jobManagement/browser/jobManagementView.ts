/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ElementRef, AfterContentChecked, ViewChild } from '@angular/core';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/workbench/parts/jobManagement/browser/agentView.component';
import { CommonServiceInterface } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { IAction, Action } from 'vs/base/common/actions';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { JobsRefreshAction, IJobActionInfo } from 'sql/platform/jobManagement/browser/jobActions';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { ITableMouseEvent } from 'sql/base/browser/ui/table/interfaces';

export abstract class JobManagementView extends TabChild implements AfterContentChecked {
	protected isVisible: boolean = false;
	protected isInitialized: boolean = false;
	protected isRefreshing: boolean = false;
	protected _showProgressWheel: boolean;
	protected _visibilityElement: ElementRef;
	protected _parentComponent: AgentViewComponent;
	protected _table: Table<any>;
	protected _actionBar: Taskbar;
	protected _serverName: string;
	public contextAction: any;

	@ViewChild('actionbarContainer') protected actionBarContainer: ElementRef;

	constructor(
		protected _commonService: CommonServiceInterface,
		protected _dashboardService: IDashboardService,
		protected _contextMenuService: IContextMenuService,
		protected _keybindingService: IKeybindingService,
		protected _instantiationService: IInstantiationService,
		protected _agentViewComponent: AgentViewComponent) {
		super();

		let self = this;
		this._serverName = this._commonService.connectionManagementService.connectionInfo.connectionProfile.serverName;
		this._dashboardService.onLayout((d) => {
			self.layout();
		});
	}

	ngAfterContentChecked() {
		if (this._visibilityElement && this._parentComponent) {
			if (this.isVisible === false && this._visibilityElement.nativeElement.offsetParent !== null) {
				this.isVisible = true;
				if (!this.isInitialized) {
					this._showProgressWheel = true;
					this.onFirstVisible();
					this.layout();
					this.isInitialized = true;
				}
			} else if (this.isVisible === true && this._parentComponent.refresh === true) {
				this._showProgressWheel = true;
				this.isRefreshing = true;
				this.onFirstVisible();
				this.layout();
				this._parentComponent.refresh = false;
			} else if (this.isVisible === true && this._visibilityElement.nativeElement.offsetParent === null) {
				this.isVisible = false;
			}
		}
	}

	abstract onFirstVisible();

	protected openContextMenu(event: ITableMouseEvent): void {
		const rowIndex = event.cell.row;

		const targetObject = this.getCurrentTableObject(rowIndex);
		const actions = this.getTableActions(targetObject);
		if (actions) {
			const ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
			const actionContext: IJobActionInfo = {
				ownerUri: ownerUri,
				targetObject: targetObject,
				component: this
			};

			this._contextMenuService.showContextMenu({
				getAnchor: () => event.anchor,
				getActions: () => actions,
				getKeyBinding: (action) => this._keybindingFor(action),
				getActionsContext: () => (actionContext)
			});
		}
	}

	protected _keybindingFor(action: IAction): ResolvedKeybinding {
		let [kb] = this._keybindingService.lookupKeybindings(action.id);
		return kb;
	}

	protected getTableActions(targetObject?: JobActionContext): IAction[] {
		return undefined;
	}

	protected getCurrentTableObject(rowIndex: number): JobActionContext {
		return undefined;
	}

	protected initActionBar() {
		let refreshAction = this._instantiationService.createInstance(JobsRefreshAction);
		let newAction: Action = this._instantiationService.createInstance(this.contextAction);
		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.setContent([
			{ action: refreshAction },
			{ action: newAction }
		]);
		let context: IJobActionInfo = { component: this, ownerUri: this._commonService.connectionManagementService.connectionInfo.ownerUri };
		this._actionBar.context = context;
	}

	public refreshJobs() {
		this._agentViewComponent.refresh = true;
	}

	public openLastNRun(notebook: azdata.AgentNotebookInfo, n: number, maxVisibleElements: number) {
	}
}

export interface JobActionContext {
	canEdit: boolean;
	job: azdata.AgentJobInfo;
}

export interface NotebookActionContext {
	canEdit: boolean;
	notebook: azdata.AgentNotebookInfo;
}
