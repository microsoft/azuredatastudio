/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function highlightSelectedText(): void {
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

export function getEncodedLinkUrl(linkUrl: string): string {
	// Need to encode URI here in order for user to click the proper encoded link in WYSIWYG
	// skip encoding it if it's already encoded
	if (!containsEncodedComponents(linkUrl)) {
		return encodeURI(linkUrl);
	}
	return linkUrl;
}

// returns true if the passed in url has encoded strings:
// space gets encoded as %20 and ;,/?:@&=+$ -> %3B%2C%2F%3F%3A%40%26%3D%2B%24
export function containsEncodedComponents(url) {
	// ie ?,=,&,/ etc
	return (decodeURI(url) !== decodeURIComponent(url));
}
