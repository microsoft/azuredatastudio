/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { endsWith } from 'vs/base/common/strings';
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
	if (!endsWith(convertedSize.toLowerCase(), 'px') && !endsWith(convertedSize.toLowerCase(), '%')) {
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
		if (endsWith(size.toLowerCase(), 'px')) {
			return +size.replace('px', '');
		} else if (endsWith(size.toLowerCase(), 'em')) {
			return +size.replace('em', '') * 11;
		}
	} else if (!size) {
		return 0;
	}
	return +size;
}
