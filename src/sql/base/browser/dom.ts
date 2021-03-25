/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from 'vs/base/common/types';

export function isHidden(element: HTMLElement): boolean {
	return element.style.display === 'none';
}

/**
 * Converts a size value into its string representation. This will add px to the end unless
 * it already ends with %. If the size value is undefined it will return the defaultValue as-is.
 * @param size The size value to convert
 * @param defaultValue The default value to use if the size is undefined
 */
export function convertSize(size: number | string | undefined, defaultValue?: string): string {
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
	container.querySelectorAll(tabbableElementsQuerySelector).forEach((element: HTMLElement) => {
		const style = window.getComputedStyle(element);
		// We should only return the elements that are visible. There are many ways to hide an element, for example setting the
		// visibility attribute to hidden/collapse, setting the display property to none, or if one of its ancestors is invisible.
		if (element.offsetWidth > 0 && element.offsetHeight > 0 && style.visibility === 'visible') {
			elements.push(element);
		}
	});
	return elements;
}
