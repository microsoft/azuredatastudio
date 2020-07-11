/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { OverflowActionBar } from 'sql/base/browser/ui/taskbar/overflowActionbar';
import { Action, IActionViewItem } from 'vs/base/common/actions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';


suite('Overflow Actionbar tests', () => {
	let overflowActionbar: OverflowActionBar;

	setup(() => {
		overflowActionbar = new OverflowActionBar(document.createElement('div'));
	});

	test('Verify moving actions from toolbar to overflow', () => {
		assert(overflowActionbar.actionsList.children.length === 0);
		assert(overflowActionbar.items.length === 0);
		assert(overflowActionbar.overflow.childElementCount === 0);

		let a1 = new Action('a1');
		let a2 = new Action('a1');
		let a3 = new Action('a3');
		overflowActionbar.pushAction([a1, a2, a3]);

		assert(overflowActionbar.actionsList.children.length === 3);
		assert(overflowActionbar.items.length === 3);
		assert(overflowActionbar.overflow.childElementCount === 0);

		// more item element '...' is added when actions are moved to the overflow
		// and a placeholder undefined element is added to the items array for calculating focus
		overflowActionbar.createMoreItemElement();
		assert(overflowActionbar.actionsList.children.length === 4);
		assert(overflowActionbar.items.length === 4);
		assert(overflowActionbar.overflow.childElementCount === 0);

		// move a3 to overflow
		overflowActionbar.collapseItem();
		assert(overflowActionbar.actionsList.children.length === 3);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 2);
		assert(overflowActionbar.overflow.childElementCount === 1);
		verifyOverflowFocusedIndex(overflowActionbar, 3);

		// move a2 to overflow
		overflowActionbar.collapseItem();
		assert(overflowActionbar.actionsList.children.length === 2);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 1);
		assert(overflowActionbar.overflow.childElementCount === 2);
		verifyOverflowFocusedIndex(overflowActionbar, 2);

		// move a2 to back to toolbar
		overflowActionbar.restoreItem();
		assert(overflowActionbar.actionsList.children.length === 3);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 2);
		assert(overflowActionbar.overflow.childElementCount === 1);
		verifyOverflowFocusedIndex(overflowActionbar, 3);

		// move a3 to back to toolbar
		overflowActionbar.restoreItem();
		assert(overflowActionbar.actionsList.children.length === 4);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 3);
		assert(overflowActionbar.overflow.childElementCount === 0);
	});

	test('Verify moving actions and separators from toolbar to overflow', () => {
		assert(overflowActionbar.actionsList.children.length === 0);
		assert(overflowActionbar.items.length === 0);
		assert(overflowActionbar.overflow.childElementCount === 0);

		let a1 = new Action('a1');
		let a2 = new Action('a1');
		let separator: HTMLElement = Taskbar.createTaskbarSeparator();
		let a3 = new Action('a3');
		overflowActionbar.pushAction([a1, a2]);
		overflowActionbar.pushElement(separator);
		overflowActionbar.pushAction([a3]);

		assert(overflowActionbar.actionsList.children.length === 4);
		assert(overflowActionbar.items.length === 3); // items only has focusable elements
		assert(overflowActionbar.overflow.childElementCount === 0);

		// more item element '...' is added when actions are moved to the overflow
		// and a placeholder undefined element is added to the items array for calculating focus
		overflowActionbar.createMoreItemElement();
		assert(overflowActionbar.actionsList.children.length === 5);
		assert(overflowActionbar.items.length === 4);
		assert(overflowActionbar.overflow.childElementCount === 0);

		// move a3 to overflow
		overflowActionbar.collapseItem();
		assert(overflowActionbar.actionsList.children.length === 4);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 2);
		assert(overflowActionbar.overflow.childElementCount === 1);
		verifyOverflowFocusedIndex(overflowActionbar, 3);

		// move separator to overflow
		overflowActionbar.collapseItem();
		assert(overflowActionbar.actionsList.children.length === 3);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 2);
		assert(overflowActionbar.overflow.childElementCount === 2);
		verifyOverflowFocusedIndex(overflowActionbar, 3);

		// move a2 to overflow
		overflowActionbar.collapseItem();
		assert(overflowActionbar.actionsList.children.length === 2);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 1);
		assert(overflowActionbar.overflow.childElementCount === 3);
		verifyOverflowFocusedIndex(overflowActionbar, 2);

		// move a2 to back to toolbar
		overflowActionbar.restoreItem();
		assert(overflowActionbar.actionsList.children.length === 3);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 2);
		assert(overflowActionbar.overflow.childElementCount === 2);
		verifyOverflowFocusedIndex(overflowActionbar, 3);

		// move separator to back to toolbar
		overflowActionbar.restoreItem();
		assert(overflowActionbar.actionsList.children.length === 4);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 2);
		assert(overflowActionbar.overflow.childElementCount === 1);
		verifyOverflowFocusedIndex(overflowActionbar, 3);

		// move a3 to back to toolbar
		overflowActionbar.restoreItem();
		assert(overflowActionbar.actionsList.children.length === 5);
		assert(overflowActionbar.items.length === 4);
		assert(getMoreItemPlaceholderIndex(overflowActionbar.items) === 3);
		assert(overflowActionbar.overflow.childElementCount === 0);
	});
});

function verifyOverflowFocusedIndex(overflowToolbar: OverflowActionBar, expectedIndex: number) {
	// click more item element to show overflow and set focus to first element
	overflowToolbar.moreElementOnClick(new MouseEvent('click'));
	assert(overflowToolbar.focusedItem === expectedIndex);
	// click to hide overflow
	overflowToolbar.moreElementOnClick(new MouseEvent('click'));
}

/**
 * Gets index of placeholder for more item element '...'. This undefined element is needed for calculating which item should be focused when the overflow menu is opened
 */
function getMoreItemPlaceholderIndex(items: IActionViewItem[]): number {
	return items.findIndex(i => i === undefined);
}
