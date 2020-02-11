/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

// CONSTANTS //////////////////////////////////////////////////////////////////////////////////////
const msInH = 3.6e6;
const msInM = 60000;
const msInS = 1000;
export const uriPrefixes = {
	default: 'connection:',
	connection: 'connection:',
	dashboard: 'dashboard:',
	insights: 'insights:',
	notebook: 'notebook:'
};


// FUNCTIONS //////////////////////////////////////////////////////////////////////////////////////

export const defaultGroupId = 'C777F06B-202E-4480-B475-FA416154D458';
export const ConnectionUriBackupIdAttributeName = 'backupId';
export const ConnectionUriRestoreIdAttributeName = 'restoreId';

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

export function generateUri(connection: IConnectionProfile, purpose?: 'dashboard' | 'insights' | 'connection' | 'notebook'): string {
	let prefix = purpose ? uriPrefixes[purpose] : uriPrefixes.default;
	let uri = generateUriWithPrefix(connection, prefix);

	return uri;
}

export function getUriPrefix(ownerUri: string): string {
	let prefix: string = '';
	if (ownerUri) {
		let index = ownerUri.indexOf('://');
		if (index > 0) {
			prefix = ownerUri.substring(0, index + 3);
		} else {
			return uriPrefixes.default;
		}
	}
	return prefix;
}

export function generateUriWithPrefix(connection: IConnectionProfile, prefix: string): string {
	let id = connection.getOptionsKey();
	let uri = prefix + (id ? id : connection.serverName + ':' + connection.databaseName);

	return uri;
}

export function findProfileInGroup(og: IConnectionProfile, groups: ConnectionProfileGroup[]): ConnectionProfile | undefined {
	for (let group of groups) {
		for (let conn of group.connections!) {
			if (conn.id === og.id) {
				return conn;
			}
		}

		if (group.hasChildren()) {
			let potentialReturn = findProfileInGroup(og, group.children!);
			if (potentialReturn) {
				return potentialReturn;
			}
		}
	}

	return undefined;
}

export function isMaster(profile: IConnectionProfile): boolean {
	// TODO: the connection profile should have a property to indicate whether the connection is a server connection or database connection
	// created issue to track the problem: https://github.com/Microsoft/azuredatastudio/issues/5193.
	return (profile.providerName === mssqlProviderName && profile.databaseName.toLowerCase() === 'master')
		|| (profile.providerName.toLowerCase() === 'pgsql' && profile.databaseName.toLowerCase() === 'postgres');
}
