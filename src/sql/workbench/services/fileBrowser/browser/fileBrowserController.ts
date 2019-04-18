/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree } from 'vs/base/parts/tree/browser/tree';
import treedefaults = require('vs/base/parts/tree/browser/treeDefaults');
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';

/**
 * Extends the tree controller to handle mouse and keyboard events on the tree elements
 */
export class FileBrowserController extends treedefaults.DefaultController {

	constructor() {
		super({ clickBehavior: treedefaults.ClickBehavior.ON_MOUSE_DOWN, openMode: treedefaults.OpenMode.SINGLE_CLICK });
	}

	protected onLeftClick(tree: ITree, element: any, event: IMouseEvent, origin: string = 'mouse'): boolean {
		// In file browser, double clicking an element calls tree.dispose(). There should not be any tree events after selection.
		if (event.detail === 2) {
			let payload = { origin: origin, originalEvent: event };
			if (tree.getInput() === element) {
				tree.clearFocus(payload);
				tree.clearSelection(payload);
			} else {
				let isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';
				if (!isMouseDown) {
					event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
				}
				event.stopPropagation();
				tree.domFocus();
				tree.setSelection([element], payload);
			}
			return true;
		} else {
			return super.onLeftClick(tree, element, event, origin);
		}
	}

	protected onEnter(tree: ITree, event: IKeyboardEvent): boolean {
		let payload = { origin: 'keyboard', originalEvent: event };

		if (tree.getHighlight()) {
			return false;
		}
		let focus = tree.getFocus();
		if (focus) {
			// In file browser, pressing enter key on an element will close dialog and call tree.dispose(). There should not be any tree events after selection.
			tree.setSelection([focus], payload);
		}
		return true;
	}
}
