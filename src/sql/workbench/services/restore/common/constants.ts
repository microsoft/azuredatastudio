/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';


export const fileFiltersSet: { label: string, filters: string[] }[] = [
	{ label: localize('backup.filterBackupFiles', "Backup Files"), filters: ['*.bak', '*.trn', '*.log'] },
	{ label: localize('backup.allFiles', "All Files"), filters: ['*'] }
];
/**
 * Backup media device type: https://docs.microsoft.com/en-us/dotnet/api/microsoft.sqlserver.management.smo.devicetype
 */
export enum DeviceType {
	LogicalDevice = 0,
	Tape = 1,
	File = 2,
	Pipe = 3,
	VirtualDevice = 4,
	Url = 5
}
