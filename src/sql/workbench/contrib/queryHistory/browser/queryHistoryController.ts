/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, ContextMenuEvent } from 'vs/base/parts/tree/browser/tree';
import * as treeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { QueryHistoryActionProvider } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryActionProvider';

/**
 * Extends the tree controller to handle clicks on the tree elements for a Query History node
 */
export class QueryHistoryController extends treeDefaults.DefaultController {

	constructor(
		private actionProvider: QueryHistoryActionProvider,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IKeybindingService private keybindingService: IKeybindingService
	) {
		super({ clickBehavior: treeDefaults.ClickBehavior.ON_MOUSE_DOWN });
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

		let anchor = { x: event.posx + 1, y: event.posy };
		this.contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => this.actionProvider.getActions(element),
			getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					tree.domFocus();
				}
			},
			getActionsContext: () => (element)
		});

		return true;
	}
}
