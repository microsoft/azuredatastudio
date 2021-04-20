/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function deepClone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result: any = Array.isArray(obj) ? [] : {};
	Object.keys(<any>obj).forEach((key: string) => {
		if ((<any>obj)[key] && typeof (<any>obj)[key] === 'object') {
			result[key] = deepClone((<any>obj)[key]);
		} else {
			result[key] = (<any>obj)[key];
		}
	});
	return result;
}

export function getSqlServerName(majorVersion: number): string | undefined {
	switch (majorVersion) {
		case 10:
			return 'SQL Server 2008';
		case 11:
			return 'SQL Server 2012';
		case 12:
			return 'SQL Server 2014';
		case 13:
			return 'SQL Server 2016';
		case 14:
			return 'SQL Server 2017';
		case 15:
			return 'SQL Server 2019';
		default:
			return undefined;
	}
}

export function convertTimeToDuration(time: number): string {
	let seconds = (time / 1000).toFixed(1);
	let minutes = (time / (1000 * 60)).toFixed(1);
	let hours = (time / (1000 * 60 * 60)).toFixed(1);
	let days = (time / (1000 * 60 * 60 * 24)).toFixed(1);
	if (time / 1000 < 60) {
		return seconds + ' Sec';
	}
	else if (time / (1000 * 60) < 60) {
		return minutes + ' Min';
	}
	else if (time / (1000 * 60 * 60) < 24) {
		return hours + ' Hrs';
	}
	else {
		return days + ' Days';
	}
}
