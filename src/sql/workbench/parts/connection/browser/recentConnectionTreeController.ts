/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DefaultController, ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ClearSingleRecentConnectionAction } from 'sql/workbench/parts/connection/browser/connectionActions';
import { ContributableActionProvider } from 'vs/workbench/browser/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IAction } from 'vs/base/common/actions';
import { Event, Emitter } from 'vs/base/common/event';
import mouse = require('vs/base/browser/mouseEvent');
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export class RecentConnectionActionsProvider extends ContributableActionProvider {
	private _onRecentConnectionRemoved = new Emitter<void>();
	public onRecentConnectionRemoved: Event<void> = this._onRecentConnectionRemoved.event;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super();
	}

	private getRecentConnectionActions(tree: ITree, element: any): IAction[] {
		let actions: IAction[] = [];
		let clearSingleConnectionAction = this._instantiationService.createInstance(ClearSingleRecentConnectionAction, ClearSingleRecentConnectionAction.ID,
			ClearSingleRecentConnectionAction.LABEL, <IConnectionProfile>element);
		clearSingleConnectionAction.onRecentConnectionRemoved(() => this._onRecentConnectionRemoved.fire());
		actions.push(clearSingleConnectionAction);
		return actions;
	}

	public hasActions(tree: ITree, element: any): boolean {
		return element instanceof ConnectionProfile;
	}

	/**
	 * Return actions given an element in the tree
	 */
	public getActions(tree: ITree, element: any): IAction[] {
		if (element instanceof ConnectionProfile) {
			return this.getRecentConnectionActions(tree, element);
		}
		return [];
	}
}

export class RecentConnectionsActionsContext {
	public connectionProfile: ConnectionProfile;
	public container: HTMLElement;
	public tree: ITree;
}

export class RecentConnectionTreeController extends DefaultController {

	private _onRecentConnectionRemoved = new Emitter<void>();
	public onRecentConnectionRemoved: Event<void> = this._onRecentConnectionRemoved.event;

	constructor(
		private clickcb: (element: any, eventish: ICancelableEvent, origin: string) => void,
		private actionProvider: RecentConnectionActionsProvider,
		private _connectionManagementService: IConnectionManagementService,
		@IContextMenuService private _contextMenuService: IContextMenuService
	) {
		super();
	}

	protected onLeftClick(tree: ITree, element: any, eventish: ICancelableEvent, origin: string = 'mouse'): boolean {
		this.clickcb(element, eventish, origin);
		return super.onLeftClick(tree, element, eventish, origin);
	}

	protected onEnter(tree: ITree, event: IKeyboardEvent): boolean {
		super.onEnter(tree, event);
		this.clickcb(tree.getSelection()[0], event, 'keyboard');
		return true;
	}

	protected onRightClick(tree: ITree, element: any, eventish: ICancelableEvent, origin: string = 'mouse'): boolean {
		this.clickcb(element, eventish, origin);
		this.showContextMenu(tree, element, eventish);
		return true;
	}

	public onMouseDown(tree: ITree, element: any, event: mouse.IMouseEvent, origin: string = 'mouse'): boolean {
		if (event.leftButton || event.middleButton) {
			return this.onLeftClick(tree, element, event, origin);
		} else {
			return this.onRightClick(tree, element, event);
		}
	}

	public onKeyDown(tree: ITree, event: IKeyboardEvent): boolean {
		if (event.keyCode === 20) {
			let element = tree.getFocus();
			if (element instanceof ConnectionProfile) {
				this._connectionManagementService.clearRecentConnection(element);
				this._onRecentConnectionRemoved.fire();
				return true;
			}
		}
		return super.onKeyDown(tree, event);
	}

	public showContextMenu(tree: ITree, element: any, event: any): boolean {
		let actionContext: any;

		if (element instanceof ConnectionProfile) {
			actionContext = new RecentConnectionsActionsContext();
			actionContext.container = event.target;
			actionContext.connectionProfile = <ConnectionProfile>element;
			actionContext.tree = tree;
		} else {
			actionContext = element;
		}

		let anchor = { x: event.x + 1, y: event.y };
		this._contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => this.actionProvider.getActions(tree, element),
			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					tree.domFocus();
				}
			},
			getActionsContext: () => (actionContext)
		});
		return true;
	}
}
