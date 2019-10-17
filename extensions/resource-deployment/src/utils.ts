/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function getErrorMessage(error: string | Error): string {
	return typeof error === 'string' ? error : error.message;
}

export function getDateTimeString(): string {
	return new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, ''); // Take the date time information and only leaving the numbers
}
