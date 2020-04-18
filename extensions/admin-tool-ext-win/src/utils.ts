/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
	return {
		name: packageJson.name,
		version: packageJson.version,
		aiKey: packageJson.aiKey
	};
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

/**
 * Map an error message into a friendly short name for the type of error.
 * @param msg The error message to map
 */
export function getTelemetryErrorType(msg: string): string {
	if (msg.indexOf('is not recognized as an internal or external command') !== -1) {
		return 'ExeNotFound';
	}
	else if (msg.indexOf('Unknown Action') !== -1) {
		return 'UnknownAction';
	}
	else if (msg.indexOf('No Action Provided') !== -1) {
		return 'NoActionProvided';
	}
	else if (msg.indexOf('Run exception') !== -1) {
		return 'RunException';
	}
	else {
		return 'Other';
	}
}
