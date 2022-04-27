/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';


export const fileFiltersSet: { label: string, filters: string[] }[] = [
	{ label: localize('backup.filterBackupFiles', "Backup Files"), filters: ['*.bak', '*.trn', '*.log'] },
	{ label: localize('backup.allFiles', "All Files"), filters: ['*'] }
];

// Backup media device type
export enum DeviceType {
	logicalDevice = 0,
	tape = 1,
	file = 2,
	pipe = 3,
	virtualDevice = 4,
	url = 5
}
