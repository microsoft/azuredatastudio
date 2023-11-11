/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import { IDisposable } from 'vs/base/common/lifecycle';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';

export function isHidden(element: HTMLElement): boolean {
	return element.style.display === 'none';
}

/**
 * Checks if the CSS calc expression is valid or not.
 * @param expression string to be tested.
 * @returns true if the expression is a valid calc expression else false.
 */
export function validateCalcExpression(expression: string): boolean {
	/**
	 * Regex that checks if a size string is a calc expression. Source: https://codepen.io/benfoster/pen/VPjLdQ
	 * If the size is a valid calc expression, we want to leave it as it is.
	 */
	const calcRegex = /calc\(( )?([\d\.]+(%|vh|vw|vmin|vmax|em|rem|px|cm|ex|in|mm|pc|pt|ch|q|deg|rad|grad|turn|s|ms|hz|khz))( )+[+\-\*\/]( )+(\-)?([\d\.]+(%|vh|vw|vmin|vmax|em|rem|px|cm|ex|in|mm|pc|pt|ch|q|deg|rad|grad|turn|s|ms|hz|khz))( )?\)/i;

	return calcRegex.test(expression);
}

/**
 * Converts a size value into its string representation. This will add px to the end unless
 * it already ends with %. If the size value is undefined it will return the defaultValue as-is.
 * @param size The size value to convert
 * @param defaultValue The default value to use if the size is undefined
 */
export function convertSize(size: number | string | undefined, defaultValue?: string): string {

	if (types.isString(size) && validateCalcExpression(size)) {
		return size;
	}

	defaultValue = defaultValue || '';
	if (types.isUndefinedOrNull(size)) {
		return defaultValue;
	}
	let convertedSize: string = size ? size.toString() : defaultValue;
	convertedSize = convertedSize.toLowerCase();
	if (!convertedSize.endsWith('px') && !convertedSize.endsWith('%')) {
		convertedSize = convertedSize + 'px';
	}
	return convertedSize;
}

/**
 * Converts a size value into its number representation. Supports px, em and unspecified units.
 * @param size The size value to convert
 */
export function convertSizeToNumber(size: number | string | undefined): number {
	if (size && typeof (size) === 'string') {
		if (size.toLowerCase().endsWith('px')) {
			return +size.replace('px', '');
		} else if (size.toLowerCase().endsWith('em')) {
			return +size.replace('em', '') * 11;
		}
	} else if (!size) {
		return 0;
	}
	return +size;
}

const tabbableElementsQuerySelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]';

/**
 * Get the focusable elements inside a HTML element
 * @param container The container element inside which we should look for the focusable elements
 * @returns The focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
	const elements = [];
	container.querySelectorAll<HTMLElement>(tabbableElementsQuerySelector).forEach((element: HTMLElement) => {
		const style = window.getComputedStyle(element);
		// We should only return the elements that are visible. There are many ways to hide an element, for example setting the
		// visibility attribute to hidden/collapse, setting the display property to none, or if one of its ancestors is invisible.
		if (element.offsetWidth > 0 && element.offsetHeight > 0 && style.visibility === 'visible') {
			elements.push(element);
		}
	});
	return elements;
}

/**
 * Trap the keyboard navigation (Tab/Shift+Tab) inside the specified container
 * @param container The container element to trap the keyboard focus in
 * @returns The object to be disposed when the trap should be removed.
 */
export function trapKeyboardNavigation(container: HTMLElement): IDisposable {
	return addDisposableListener(container, EventType.KEY_DOWN, (e) => {
		const focusableElements = getFocusableElements(container);
		if (focusableElements.length === 0) {
			return;
		}
		const firstFocusable = focusableElements[0];
		const lastFocusable = focusableElements[focusableElements.length - 1];
		const event = new StandardKeyboardEvent(e);
		let elementToFocus = undefined;
		if (event.equals(KeyMod.Shift | KeyCode.Tab) && firstFocusable === document.activeElement) {
			// Backward navigation
			elementToFocus = lastFocusable;
		} else if (event.equals(KeyCode.Tab) && lastFocusable === document.activeElement) {
			// Forward navigation
			elementToFocus = firstFocusable;
		}

		if (elementToFocus) {
			e.preventDefault();
			elementToFocus.focus();
		}
	});
}

/**
 * Convert the SlickGrid's keydown event to VSCode standard keyboard event.
 */
export function convertJQueryKeyDownEvent(e: DOMEvent): StandardKeyboardEvent {
	return new StandardKeyboardEvent((<any>e as JQuery.KeyDownEvent).originalEvent);
}
