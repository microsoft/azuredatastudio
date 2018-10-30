
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// TODO: The content of this file should be refactored to an extension
export function getKnoxUrl(host: string, port: string): string {
	return `https://${host}:${port}/gateway`;
}

export function getLivyUrl(serverName: string, port: string): string {
	return getKnoxUrl(serverName, port) + '/default/livy/v1/';
}