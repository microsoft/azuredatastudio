/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, ContextMenuEvent } from 'vs/base/parts/tree/browser/tree';
import * as treedefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ServerTreeActionProvider } from 'sql/workbench/services/objectExplorer/browser/serverTreeActionProvider';
import { ObjectExplorerActionsContext } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';

/**
 * Extends the tree controller to handle clicks on the tree elements
 */
export class ServerTreeController extends treedefaults.DefaultController {

	constructor(
		private actionProvider: ServerTreeActionProvider,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IKeybindingService private keybindingService: IKeybindingService
	) {
		super({
			clickBehavior: treedefaults.ClickBehavior.ON_MOUSE_DOWN,
			openMode: treedefaults.OpenMode.SINGLE_CLICK
		});
	}

	public onClick(tree: ITree, element: any, event: IMouseEvent): boolean {
		return super.onClick(tree, element, event);
	}

	protected onLeftClick(tree: ITree, element: any, event: IMouseEvent, origin: string = 'mouse'): boolean {
		return super.onLeftClick(tree, element, event, origin);
	}

	// Do not allow left / right to expand and collapse groups #7848
	protected onLeft(tree: ITree, event: IKeyboardEvent): boolean {
		return true;
	}

	protected onRight(tree: ITree, event: IKeyboardEvent): boolean {
		return true;
	}

	protected onEnter(tree: ITree, event: IKeyboardEvent): boolean {
		return super.onEnter(tree, event);
	}

	/**
	 * Return actions in the context menu
	 */
	public onContextMenu(tree: ITree, element: any, event: ContextMenuEvent): boolean {
		if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'input') {
			return false;
		}
		// Check if clicked on some element
		if (element === tree.getInput()) {
			return false;
		}

		event.preventDefault();
		event.stopPropagation();

		tree.setFocus(element);

		let actionContext: any;
		if (element instanceof TreeNode) {
			let context = new ObjectExplorerActionsContext();
			context.nodeInfo = element.toNodeInfo();
			// Note: getting DB name before, but intentionally not using treeUpdateUtils.getConnectionProfile as it replaces
			// the connection ID with a new one. This breaks a number of internal tasks
			context.connectionProfile = element.getConnectionProfile().toIConnectionProfile();
			context.connectionProfile.databaseName = element.getDatabaseName();
			actionContext = context;
		} else if (element instanceof ConnectionProfile) {
			let context = new ObjectExplorerActionsContext();
			context.connectionProfile = element.toIConnectionProfile();
			context.isConnectionNode = true;
			actionContext = context;
		} else {
			// TODO: because the connection group is used as a context object and isn't serializable,
			// the Group-level context menu is not currently extensible
			actionContext = element;
		}

		let anchor = { x: event.posx + 1, y: event.posy };
		this.contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => this.actionProvider.getActions(tree, element),
			getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
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
