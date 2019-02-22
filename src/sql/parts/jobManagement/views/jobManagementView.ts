/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ElementRef, AfterContentChecked, ViewChild } from '@angular/core';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IAction, Action } from 'vs/base/common/actions';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Taskbar } from '../../../base/browser/ui/taskbar/taskbar';
import { JobsRefreshAction } from 'sql/platform/jobManagement/common/jobActions';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';

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
		protected _instantiationService: IInstantiationService) {
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

	protected openContextMenu(event): void {
		let rowIndex = event.cell.row;

		let targetObject = this.getCurrentTableObject(rowIndex);
		let actions = this.getTableActions();
		if (actions) {
			let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
			let actionContext = {
				ownerUri: ownerUri,
				targetObject: targetObject
			};

			let anchor = { x: event.pageX + 1, y: event.pageY };
			this._contextMenuService.showContextMenu({
				getAnchor: () => anchor,
				getActions: () => actions,
				getKeyBinding: (action) => this._keybindingFor(action),
				getActionsContext: () => (actionContext)
			});
		}
	}

	protected _keybindingFor(action: IAction): ResolvedKeybinding {
		var [kb] = this._keybindingService.lookupKeybindings(action.id);
		return kb;
	}

	protected getTableActions(): IAction[] {
		return undefined;
	}

	protected getCurrentTableObject(rowIndex: number): any {
		return undefined;
	}

	protected initActionBar() {
		let refreshAction = this._instantiationService.createInstance(JobsRefreshAction);
		let newAction: Action = this._instantiationService.createInstance(this.contextAction);
		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar, this._contextMenuService);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: refreshAction },
			{ action: newAction }
		]);
	}
}