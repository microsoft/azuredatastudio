/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DefaultController, ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';

export class SavedConnectionTreeController extends DefaultController {
	constructor(private clickcb: (element: any, eventish: ICancelableEvent, origin: string) => void) {
		super();
	}

	protected onLeftClick(tree: ITree, element: any, eventish: ICancelableEvent, origin: string = 'mouse'): boolean {
		this.clickcb(element, eventish, origin);
		return super.onLeftClick(tree, element, eventish, origin);
	}

	protected onEnter(tree: ITree, event: IKeyboardEvent): boolean {
		super.onEnter(tree, event);

		// grab the current selection for use later
		let selection = tree.getSelection();

		this.clickcb(selection[0], event, 'keyboard');
		tree.toggleExpansion(selection[0]);
		return true;
	}
}
