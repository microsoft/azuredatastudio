/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Action, IAction } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IAngularEventingService, AngularEventType } from 'sql/services/angularEventing/angularEventingService';

export class EditDashboardAction extends Action {

	private static readonly ID = 'editDashboard';
	private static readonly EDITLABEL = nls.localize('editDashboard', "Edit");
	private static readonly EXITLABEL = nls.localize('editDashboardExit', "Exit");
	private static readonly ICON = 'edit';

	private _state = 0;

	constructor(
		private editFn: () => void,
		private context: any //this
	) {
		super(EditDashboardAction.ID, EditDashboardAction.EDITLABEL, EditDashboardAction.ICON);
	}

	run(): TPromise<boolean> {
		try {
			this.editFn.apply(this.context);
			this.toggleLabel();
			return TPromise.as(true);
		} catch (e) {
			return TPromise.as(false);
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
	private static readonly LABEL = nls.localize('refreshWidget', 'Refresh');
	private static readonly ICON = 'refresh';

	constructor(
		private refreshFn: () => void,
		private context: any // this
	) {
		super(RefreshWidgetAction.ID, RefreshWidgetAction.LABEL, RefreshWidgetAction.ICON);
	}

	run(): TPromise<boolean> {
		try {
			this.refreshFn.apply(this.context);
			return TPromise.as(true);
		} catch (e) {
			return TPromise.as(false);
		}
	}
}

export class ToggleMoreWidgetAction extends Action {

	private static readonly ID = 'toggleMore';
	private static readonly LABEL = nls.localize('toggleMore', 'Toggle More');
	private static readonly ICON = 'toggle-more';

	constructor(
		private _actions: Array<IAction>,
		private _context: any,
		@IContextMenuService private _contextMenuService: IContextMenuService
	) {
		super(ToggleMoreWidgetAction.ID, ToggleMoreWidgetAction.LABEL, ToggleMoreWidgetAction.ICON);
	}

	run(context: StandardKeyboardEvent): TPromise<boolean> {
		this._contextMenuService.showContextMenu({
			getAnchor: () => context.target,
			getActions: () => TPromise.as(this._actions),
			getActionsContext: () => this._context
		});
		return TPromise.as(true);
	}
}

export class DeleteWidgetAction extends Action {
	private static readonly ID = 'deleteWidget';
	private static readonly LABEL = nls.localize('deleteWidget', "Delete Widget");
	private static readonly ICON = 'close';

	constructor(
		private _widgetId,
		private _uri,
		@IAngularEventingService private angularEventService: IAngularEventingService
	) {
		super(DeleteWidgetAction.ID, DeleteWidgetAction.LABEL, DeleteWidgetAction.ICON);
	}

	run(): TPromise<boolean> {
		this.angularEventService.sendAngularEvent(this._uri, AngularEventType.DELETE_WIDGET, { id: this._widgetId });
		return TPromise.as(true);
	}
}
