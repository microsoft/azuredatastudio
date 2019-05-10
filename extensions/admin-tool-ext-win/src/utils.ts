/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
}

/**
 * Escapes all single-quotes (') by prefixing them with another single quote ('')
 * ' => ''
 * @param value The string to escape
 */
export function doubleEscapeSingleQuotes(value: string): string {
	return value.replace(/'/g, '\'\'');
}

/**
 * Escape all double-quotes (") by prefixing them with a \
 *  " => \"
 * @param value The string to escape
 */
export function backEscapeDoubleQuotes(value: string): string {
	return value.replace(/"/g, '\\"');
}