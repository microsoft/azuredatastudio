/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

// Constants
export const maxDevices: number = 64;

/**
 * Backup phisical device type: https://docs.microsoft.com/en-us/dotnet/api/microsoft.sqlserver.management.smo.backupdevicetype
 */
export enum PhysicalDeviceType {
	Disk = 2,
	FloppyA = 3,
	FloppyB = 4,
	Tape = 5,
	Pipe = 6,
	CDRom = 7,
	Url = 9,
	Unknown = 100
}

/**
 * Backup media device type: https://docs.microsoft.com/en-us/dotnet/api/microsoft.sqlserver.management.smo.devicetype
 */
export enum MediaDeviceType {
	LogicalDevice = 0,
	Tape = 1,
	File = 2,
	Pipe = 3,
	VirtualDevice = 4,
	Url = 5
}

export const recoveryModelSimple = 'Simple';
export const recoveryModelFull = 'Full';

// Constants for UI strings
export const labelDatabase = localize('backup.labelDatabase', "Database");
export const labelFilegroup = localize('backup.labelFilegroup', "Files and filegroups");
export const labelFull = localize('backup.labelFull', "Full");
export const labelDifferential = localize('backup.labelDifferential', "Differential");
export const labelLog = localize('backup.labelLog', "Transaction Log");
export const labelDisk = localize('backup.labelDisk', "Disk");
export const labelUrl = localize('backup.labelUrl', "Url");

export const defaultCompression = localize('backup.defaultCompression', "Use the default server setting");
export const compressionOn = localize('backup.compressBackup', "Compress backup");
export const compressionOff = localize('backup.doNotCompress', "Do not compress backup");

export const aes128 = 'AES 128';
export const aes192 = 'AES 192';
export const aes256 = 'AES 256';
export const tripleDES = 'Triple DES';

export const serverCertificate = localize('backup.serverCertificate', "Server Certificate");
export const asymmetricKey = localize('backup.asymmetricKey', "Asymmetric Key");

