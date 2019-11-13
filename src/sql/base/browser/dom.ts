/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function isHidden(element: HTMLElement): boolean {
	return element.style.display === 'none';
}

/**
 * Whether an HTMLElement is currently visible or not. This takes into account whether ancestor
 * elements are hidden (thus causing the element itself to also be hidden).
 * @param element The element to check
 */
export function isVisible(element: HTMLElement): boolean {
	// Logic from https://github.com/angular-ui/bootstrap/blob/master/src/modal/modal.js#L219
	return !!(element.offsetWidth ||
		element.offsetHeight ||
		element.getClientRects().length);
}
