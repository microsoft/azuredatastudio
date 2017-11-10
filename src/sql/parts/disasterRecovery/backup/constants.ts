/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from 'vs/nls';

// Constants
export const maxDevices: number = 64;

// Constants for backup physical device type
export const backupDeviceTypeDisk = 2;
export const backupDeviceTypeTape = 5;
export const backupDeviceTypeURL = 9;

// Constants for backup media device type
export const deviceTypeLogicalDevice = 0;
export const deviceTypeTape = 1;
export const deviceTypeFile = 2;
export const deviceTypeURL = 5;

export const recoveryModelSimple = 'Simple';
export const recoveryModelFull = 'Full';

// Constants for UI strings
export const labelDatabase = 'Database';
export const labelFilegroup = 'Files and filegroups';
export const labelFull = 'Full';
export const labelDifferential = 'Differential';
export const labelLog = 'Transaction Log';
export const labelDisk = 'Disk';
export const labelUrl = 'Url';

export const defaultCompression = 'Use the default server setting';
export const compressionOn = 'Compress backup';
export const compressionOff = 'Do not compress backup';

export const aes128 = 'AES 128';
export const aes192 = 'AES 192';
export const aes256 = 'AES 256';
export const tripleDES = 'Triple DES';

export const serverCertificate = "Server Certificate";
export const asymmetricKey = "Asymmetric Key";

export const fileFiltersSet: [ {label: string, filters: string[]} ] = [
	{ label: localize('backup.filterBackupFiles', "Backup Files"), filters: ['*.bak', '*.trn', '*.log'] },
	{ label: localize('backup.allFiles', "All Files"), filters: ['*'] }
];