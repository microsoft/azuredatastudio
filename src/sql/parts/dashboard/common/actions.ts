/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Action, IAction } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IDisposable } from 'vs/base/common/lifecycle';

import { IAngularEventingService, AngularEventType, IAngularEvent } from 'sql/services/angularEventing/angularEventingService';
import { INewDashboardTabDialogService } from 'sql/parts/dashboard/newDashboardTabDialog/interface';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { toDisposableSubscription } from 'sql/parts/common/rxjsUtils';
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

	public run(): TPromise<boolean> {
		this._isPinned = !this._isPinned;
		this.updatePinStatus();
		this.angularEventService.sendAngularEvent(this._uri, AngularEventType.PINUNPIN_TAB, { tabId: this._tabId, isPinned: this._isPinned });
		return TPromise.as(true);
	}
}

export class AddFeatureTabAction extends Action {
	private static readonly ID = 'openInstalledFeatures';
	private static readonly LABEL = nls.localize('openInstalledFeatures', "Open installed features");
	private static readonly ICON = 'new';

	private _disposables: IDisposable[] = [];

	constructor(
		private _dashboardTabs: Array<IDashboardTab>,
		private _openedTabs: Array<IDashboardTab>,
		private _uri: string,
		@INewDashboardTabDialogService private _newDashboardTabService: INewDashboardTabDialogService,
		@IAngularEventingService private _angularEventService: IAngularEventingService
	) {
		super(AddFeatureTabAction.ID, AddFeatureTabAction.LABEL, AddFeatureTabAction.ICON);
		this._disposables.push(toDisposableSubscription(this._angularEventService.onAngularEvent(this._uri, (event) => this.handleDashboardEvent(event))));
	}

	run(): TPromise<boolean> {
		this._newDashboardTabService.showDialog(this._dashboardTabs, this._openedTabs, this._uri);
		return TPromise.as(true);
	}

	dispose() {
		super.dispose();
		this._disposables.forEach((item) => item.dispose());
	}

	private handleDashboardEvent(event: IAngularEvent): void {
		switch (event.event) {
			case AngularEventType.NEW_TABS:
				let openedTabs = <IDashboardTab[]>event.payload.dashboardTabs;
				openedTabs.forEach(tab => {
					let existedTab = this._openedTabs.find(i => i === tab);
					if (!existedTab) {
						this._openedTabs.push(tab);
					}
				});
				break;
			case AngularEventType.CLOSE_TAB:
				let index = this._openedTabs.findIndex(i => i.id === event.payload.id);
				this._openedTabs.splice(index, 1);
				break;
		}
	}
}
