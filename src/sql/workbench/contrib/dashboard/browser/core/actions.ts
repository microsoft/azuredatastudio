/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action, IAction } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';

import { IAngularEventingService, AngularEventType, IAngularEvent } from 'sql/platform/angularEventing/browser/angularEventingService';
import { INewDashboardTabDialogService } from 'sql/workbench/services/dashboard/browser/newDashboardTabDialog';
import { IDashboardTab } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { find, firstIndex } from 'vs/base/common/arrays';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';

export class EditDashboardAction extends Action {

	private static readonly ID = 'editDashboard';
	private static readonly EDITLABEL = nls.localize('editDashboard', "Edit");
	private static readonly EXITLABEL = nls.localize('editDashboardExit', "Exit");
	private static readonly CSSCLASS = 'edit-toolbar dashboard-toolbar-item';

	private _state = 0;

	constructor(
		private editFn: () => void,
		private context: any //this
	) {
		super(EditDashboardAction.ID, EditDashboardAction.EDITLABEL, EditDashboardAction.CSSCLASS);
	}

	run(): Promise<boolean> {
		try {
			this.editFn.apply(this.context);
			this.toggleLabel();
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}

	private toggleLabel(): void {
		if (this._state === 0) {
			this.label = EditDashboardAction.EXITLABEL;
			this._state = 1;
		} else {
			this.label = EditDashboardAction.EDITLABEL;
			this._state = 0;
		}
	}
}

export class RefreshWidgetAction extends Action {

	private static readonly ID = 'refreshWidget';
	private static readonly LABEL = nls.localize('refreshWidget', "Refresh");
	private static readonly CSSCLASS = 'refresh dashboard-toolbar-item';

	constructor(
		private refreshFn: () => void,
		private context: any // this
	) {
		super(RefreshWidgetAction.ID, RefreshWidgetAction.LABEL, RefreshWidgetAction.CSSCLASS);
	}

	run(): Promise<boolean> {
		try {
			this.refreshFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class ToolbarAction extends Action {
	constructor(
		id: string,
		label,
		cssClass: string,
		private runFn: (id: string) => void,
		private context: any // this
	) {
		super(id, label, cssClass);
	}

	run(): Promise<boolean> {
		try {
			this.runFn.apply(this.context, [this.id]);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class RestoreToolbarAction extends Action {
	private static readonly ID = 'restore';
	private static readonly LABEL = nls.localize('restore', "Restore");
	private static readonly CSSCLASS = 'restore-toolbar dashboard-toolbar-item';

	constructor(
		private restoreFn: () => void,
		private context: any // this
	) {
		super(RestoreToolbarAction.ID, RestoreToolbarAction.LABEL, RestoreToolbarAction.CSSCLASS);
	}

	run(): Promise<boolean> {
		try {
			this.restoreFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class BackupToolbarAction extends Action {
	private static readonly ID = 'backup';
	private static readonly LABEL = nls.localize('backup', "Backup");
	private static readonly CSSCLASS = 'backup-toolbar dashboard-toolbar-item';

	constructor(
		private backupFn: () => void,
		private context: any // this
	) {
		super(BackupToolbarAction.ID, BackupToolbarAction.LABEL, BackupToolbarAction.CSSCLASS);
	}

	run(): Promise<boolean> {
		try {
			this.backupFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class ManageExtensionsToolbarAction extends Action {
	private static readonly ID = 'manageExtensions';
	private static readonly LABEL = nls.localize('manageExtensions', "Manage extensions");
	private static readonly CSSCLASS = 'manage-extensions-toolbar dashboard-toolbar-item';

	constructor(
		private manageExtensionsFn: () => void,
		private context: any // this
	) {
		super(ManageExtensionsToolbarAction.ID, ManageExtensionsToolbarAction.LABEL, ManageExtensionsToolbarAction.CSSCLASS);
	}

	run(): Promise<boolean> {
		try {
			this.manageExtensionsFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class NewQueryAction extends Action {
	private static readonly ID = 'newQuery';
	private static readonly LABEL = nls.localize('newQuery', "New Query");
	private static readonly CSSCLASS = 'new-query-toolbar dashboard-toolbar-item';

	constructor(
		private newQueryFn: () => void,
		private context: any // this
	) {
		super(NewQueryAction.ID, NewQueryAction.LABEL, NewQueryAction.CSSCLASS);
	}

	run(): Promise<boolean> {
		try {
			this.newQueryFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class NewNotebookToolbarAction extends Action {
	public static readonly ID = 'notebook.command.new';
	public static readonly LABEL = nls.localize('newNotebookAction', "New Notebook");
	private static readonly CSSCLASS = 'new-notebook-toolbar dashboard-toolbar-item';

	constructor(
		private newNotebookFn: () => void,
		private context: any // this
	) {
		super(NewNotebookToolbarAction.ID, NewNotebookToolbarAction.LABEL, NewNotebookToolbarAction.CSSCLASS);
	}

	async run(): Promise<boolean> {
		try {
			this.newNotebookFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class ToggleMoreWidgetAction extends Action {

	private static readonly ID = 'toggleMore';
	private static readonly LABEL = nls.localize('toggleMore', "Toggle More");
	private static readonly ICON = 'toggle-more';

	constructor(
		private readonly _actions: Array<IAction>,
		private readonly _context: CellContext,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService
	) {
		super(ToggleMoreWidgetAction.ID, ToggleMoreWidgetAction.LABEL, ToggleMoreWidgetAction.ICON);
	}

	run(context: StandardKeyboardEvent): Promise<boolean> {
		this._contextMenuService.showContextMenu({
			getAnchor: () => context.target,
			getActions: () => this._actions,
			getActionsContext: () => this._context
		});
		return Promise.resolve(true);
	}
}

export class DeleteWidgetAction extends Action {
	private static readonly ID = 'deleteWidget';
	private static readonly LABEL = nls.localize('deleteWidget', "Delete Widget");
	private static readonly ICON = 'close';

	constructor(
		private _widgetId: string,
		private _uri: string,
		@IAngularEventingService private readonly angularEventService: IAngularEventingService
	) {
		super(DeleteWidgetAction.ID, DeleteWidgetAction.LABEL, DeleteWidgetAction.ICON);
	}

	run(): Promise<boolean> {
		this.angularEventService.sendAngularEvent(this._uri, AngularEventType.DELETE_WIDGET, { id: this._widgetId });
		return Promise.resolve(true);
	}
}

export class PinUnpinTabAction extends Action {
	private static readonly ID = 'pinTab';
	private static readonly PINLABEL = nls.localize('clickToUnpin', "Click to unpin");
	private static readonly UNPINLABEL = nls.localize('clickToPin', "Click to pin");
	private static readonly PINICON = 'pin';
	private static readonly UNPINICON = 'unpin';

	constructor(
		private _tabId: string,
		private _uri: string,
		private _isPinned: boolean,
		@IAngularEventingService private angularEventService: IAngularEventingService
	) {
		super(PinUnpinTabAction.ID, PinUnpinTabAction.PINLABEL, PinUnpinTabAction.PINICON);
		this.updatePinStatus();
	}

	private updatePinStatus() {
		if (this._isPinned) {
			this.label = PinUnpinTabAction.PINLABEL;
			this.class = PinUnpinTabAction.PINICON;
		} else {
			this.label = PinUnpinTabAction.UNPINLABEL;
			this.class = PinUnpinTabAction.UNPINICON;
		}
	}

	public run(): Promise<boolean> {
		this._isPinned = !this._isPinned;
		this.updatePinStatus();
		this.angularEventService.sendAngularEvent(this._uri, AngularEventType.PINUNPIN_TAB, { tabId: this._tabId, isPinned: this._isPinned });
		return Promise.resolve(true);
	}
}

export class AddFeatureTabAction extends Action {
	private static readonly ID = 'openInstalledFeatures';
	private static readonly LABEL = nls.localize('addFeatureAction.openInstalledFeatures', "Open installed features");
	private static readonly ICON = 'new';

	constructor(
		private _dashboardTabs: Array<IDashboardTab>,
		private _openedTabs: Array<IDashboardTab>,
		private _uri: string,
		@INewDashboardTabDialogService private _newDashboardTabService: INewDashboardTabDialogService,
		@IAngularEventingService private _angularEventService: IAngularEventingService
	) {
		super(AddFeatureTabAction.ID, AddFeatureTabAction.LABEL, AddFeatureTabAction.ICON);
		this._register(this._angularEventService.onAngularEvent(this._uri)(event => this.handleDashboardEvent(event)));
	}

	run(): Promise<boolean> {
		this._newDashboardTabService.showDialog(this._dashboardTabs, this._openedTabs, this._uri);
		return Promise.resolve(true);
	}

	private handleDashboardEvent(event: IAngularEvent): void {
		switch (event.event) {
			case AngularEventType.NEW_TABS:
				const openedTabs = <IDashboardTab[]>event.payload.dashboardTabs;
				openedTabs.forEach(tab => {
					const existedTab = find(this._openedTabs, i => i === tab);
					if (!existedTab) {
						this._openedTabs.push(tab);
					}
				});
				break;
			case AngularEventType.CLOSE_TAB:
				const index = firstIndex(this._openedTabs, i => i.id === event.payload.id);
				this._openedTabs.splice(index, 1);
				break;
		}
	}
}

export class CollapseWidgetAction extends Action {
	private static readonly ID = 'collapseWidget';
	private static readonly COLLPASE_LABEL = nls.localize('collapseWidget', "Collapse");
	private static readonly EXPAND_LABEL = nls.localize('expandWidget', "Expand");
	private static readonly COLLAPSE_ICON = 'maximize-panel-action';
	private static readonly EXPAND_ICON = 'minimize-panel-action';

	constructor(
		private _uri: string,
		private _widgetUuid: string,
		private collpasedState: boolean,
		@IAngularEventingService private _angularEventService: IAngularEventingService
	) {
		super(
			CollapseWidgetAction.ID,
			collpasedState ? CollapseWidgetAction.EXPAND_LABEL : CollapseWidgetAction.COLLPASE_LABEL,
			collpasedState ? CollapseWidgetAction.EXPAND_ICON : CollapseWidgetAction.COLLAPSE_ICON
		);
	}

	run(): Promise<boolean> {
		this._toggleState();
		this._angularEventService.sendAngularEvent(this._uri, AngularEventType.COLLAPSE_WIDGET, this._widgetUuid);
		return Promise.resolve(true);
	}

	private _toggleState(): void {
		this._updateState(!this.collpasedState);
	}

	private _updateState(collapsed: boolean): void {
		if (collapsed === this.collpasedState) {
			return;
		}
		this.collpasedState = collapsed;
		this._setClass(this.collpasedState ? CollapseWidgetAction.EXPAND_ICON : CollapseWidgetAction.COLLAPSE_ICON);
		this.label = this.collpasedState ? CollapseWidgetAction.EXPAND_LABEL : CollapseWidgetAction.COLLPASE_LABEL;
	}

	public set state(collapsed: boolean) {
		this._updateState(collapsed);
	}
}
