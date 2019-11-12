/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const msInH = 3.6e6;
const msInM = 60000;
const msInS = 1000;

/**
 * Takes a string in the format of HH:MM:SS.MS and returns a number representing the time in
 * miliseconds
 * @param value The string to convert to milliseconds
 * @return False is returned if the string is an invalid format,
 *		 the number of milliseconds in the time string is returned otherwise.
 */
export function parseTimeString(value: string): number | boolean {
	if (!value) {
		return false;
	}
	let tempVal = value.split('.');

	if (tempVal.length === 1) {
		// Ideally would handle more cleanly than this but for now handle case where ms not set
		tempVal = [tempVal[0], '0'];
	} else if (tempVal.length !== 2) {
		return false;
	}

	let msString = tempVal[1];
	let msStringEnd = msString.length < 3 ? msString.length : 3;
	let ms = parseInt(tempVal[1].substring(0, msStringEnd), 10);

	tempVal = tempVal[0].split(':');

	if (tempVal.length !== 3) {
		return false;
	}

	let h = parseInt(tempVal[0], 10);
	let m = parseInt(tempVal[1], 10);
	let s = parseInt(tempVal[2], 10);

	return ms + (h * msInH) + (m * msInM) + (s * msInS);
}

/**
 * Takes a number of milliseconds and converts it to a string like HH:MM:SS.fff
 * @param value The number of milliseconds to convert to a timespan string
 * @returns A properly formatted timespan string.
 */
export function parseNumAsTimeString(value: number, includeFraction: boolean = true): string {
	let tempVal = value;
	let h = Math.floor(tempVal / msInH);
	tempVal %= msInH;
	let m = Math.floor(tempVal / msInM);
	tempVal %= msInM;
	let s = Math.floor(tempVal / msInS);
	tempVal %= msInS;

	let hs = h < 10 ? '0' + h : '' + h;
	let ms = m < 10 ? '0' + m : '' + m;
	let ss = s < 10 ? '0' + s : '' + s;
	let mss = tempVal < 10 ? '00' + tempVal : tempVal < 100 ? '0' + tempVal : '' + tempVal;

	let rs = hs + ':' + ms + ':' + ss;

	return tempVal > 0 && includeFraction ? rs + '.' + mss : rs;
}
