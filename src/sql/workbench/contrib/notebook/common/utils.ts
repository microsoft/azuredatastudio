/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isWindows } from 'vs/base/common/platform';

/**
 * Due to marked js parsing returning an invalid path (ex. ....\) we must format the path to ensure directories are formatted properly (ex. ..\..\).
 * Issue tracked here: https://github.com/markedjs/marked/issues/2135
 * The function only formats the path for Windows platform (in which the invalid form occurs) and checks to see if the path is invalid based on the leading periods.
 * We use the first slash of path and create a relative path format (..\) string based on amount of leading periods
 * and then concatenate the relative path format string to rest of path after slash
 * @param href is the relative path
 * @returns properly formatted relative path
 */
export function replaceInvalidLinkPath(href: string): string {
	if (isWindows && href.startsWith('...')) {
		let slashIndex = href.indexOf('\\');
		href = '..\\'.repeat(slashIndex / 2) + href.substring(slashIndex + 1);
		return href;
	} else {
		// returns original path since it is valid
		return href;
	}
}

/**
 * Highlights markdown text
 */
export function highlightText(): void {
	let selectionFocusNode = document.getSelection()?.focusNode;
	// Find if element is wrapped in <mark></mark>
	while (selectionFocusNode?.parentNode?.nodeName?.toLowerCase() && selectionFocusNode?.parentNode?.nodeName?.toLowerCase() !== 'mark') {
		selectionFocusNode = selectionFocusNode.parentNode;
	}
	// Find if element is wrapped in <span background-color="yellow">
	if (selectionFocusNode?.parentNode?.nodeName?.toLowerCase() !== 'mark') {
		selectionFocusNode = document.getSelection()?.focusNode;
		while (selectionFocusNode?.parentNode?.nodeName?.toLowerCase() && selectionFocusNode?.parentNode?.nodeName?.toLowerCase() !== 'span' && selectionFocusNode?.parentElement?.style?.backgroundColor !== 'yellow') {
			selectionFocusNode = selectionFocusNode.parentNode;
		}
	}
	let nodeName = selectionFocusNode?.parentNode?.nodeName?.toLowerCase();
	let backgroundColor = selectionFocusNode?.parentElement?.style?.backgroundColor;
	if (nodeName === 'mark') {
		let oldParent = selectionFocusNode.parentNode;
		let newParent = selectionFocusNode.parentNode.parentNode;
		let oldParentNextSibling = oldParent.nextSibling;
		// Remove mark element, reparent
		while (oldParent.childNodes.length > 0) {
			// If no next sibling, then old parent was the final child node, so we can append
			if (!oldParentNextSibling) {
				newParent.appendChild(oldParent.firstChild);
			} else {
				newParent.insertBefore(oldParent.firstChild, oldParentNextSibling);
			}
		}
		// Empty span required to force an input so that HTML change is seen from text cell component
		// This span doesn't have any effect on the markdown generated.
		document.execCommand('formatBlock', false, 'span');
	} else if (selectionFocusNode?.parentNode?.nodeName?.toLowerCase() === 'span' && backgroundColor === 'yellow') {
		selectionFocusNode.parentElement.style.backgroundColor = '';
		// Empty span required to force an input so that HTML change is seen from text cell component
		// This span doesn't have any effect on the markdown generated.
		document.execCommand('formatBlock', false, 'span');
	} else {
		document.execCommand('hiliteColor', false, 'Yellow');
	}
}

/**
 * This function ensures that only the keybinding that the user did within does not trigger multiple events
 * @param e Event from keybinding
 */
export function preventDefaultAndPropagation(e: KeyboardEvent): void {
	e.stopPropagation();
	e.preventDefault();
}
