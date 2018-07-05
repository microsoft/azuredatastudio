/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ElementRef, AfterContentChecked } from '@angular/core';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { IAction } from 'vs/base/common/actions';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { Disposable } from 'vs/base/common/lifecycle';
import { Table } from 'sql/base/browser/ui/table/table';
import { TPromise } from 'vs/base/common/winjs.base';

export abstract class JobManagementView extends Disposable implements AfterContentChecked {
	protected isVisible: boolean = false;
	protected isInitialized: boolean = false;
	protected isRefreshing: boolean = false;
	protected _showProgressWheel: boolean;
	protected _visibilityElement: ElementRef;
	protected _parentComponent: AgentViewComponent;
	protected _table: Table<any>;

	constructor(
		protected _contextMenuService: IContextMenuService,
		protected _keybindingService: IKeybindingService) {
		super();
	}

	ngAfterContentChecked() {
		if (this._visibilityElement && this._parentComponent) {
			if (this.isVisible === false && this._visibilityElement.nativeElement.offsetParent !== null) {
				this.isVisible = true;
				if (!this.isInitialized) {
					this._showProgressWheel = true;
					this.onFirstVisible();
					this.isInitialized = true;
				}
			} else if (this.isVisible === true && this._parentComponent.refresh === true) {
				this._showProgressWheel = true;
				this.onFirstVisible();
				this.isRefreshing = true;
				this._parentComponent.refresh = false;
			} else if (this.isVisible === true && this._visibilityElement.nativeElement.offsetParent === null) {
				this.isVisible = false;
			}
		}
	}

	abstract onFirstVisible();

	protected openContextMenu(event): void {
		let actions = this.getTableActions();
		if (actions) {
			let rowIndex = event.cell.row;

			let actionContext= {
				rowIndex: rowIndex
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

	protected getTableActions(): TPromise<IAction[]> {
		return undefined;
	}
}