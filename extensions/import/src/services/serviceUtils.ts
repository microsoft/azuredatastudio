/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
export function getAppDataPath(): string {
	let platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

export function getDefaultLogLocation(): string {
	return path.join(getAppDataPath(), 'azuredatastudio');
}

export function ensure(target: object, key: string): any {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
}

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
}

export function verifyPlatform(): Thenable<boolean> {
	if (os.platform() === 'darwin' && parseFloat(os.release()) < 16) {
		return Promise.resolve(false);
	} else {
		return Promise.resolve(true);
	}
}

export function getRuntimeDisplayName(runtime: Runtime): string {
	switch (runtime) {
		case Runtime.Windows_64:
			return 'Windows';
		case Runtime.Windows_86:
			return 'Windows';
		case Runtime.OSX:
			return 'OSX';
		case Runtime.Linux_64:
			return 'Linux';
		default:
			return 'Unknown';
	}
}

export enum Runtime {
	Unknown = <any>'Unknown',
	Windows_86 = <any>'Windows_86',
	Windows_64 = <any>'Windows_64',
	OSX = <any>'OSX',
	CentOS_7 = <any>'CentOS_7',
	Debian_8 = <any>'Debian_8',
	Fedora_23 = <any>'Fedora_23',
	OpenSUSE_13_2 = <any>'OpenSUSE_13_2',
	SLES_12_2 = <any>'SLES_12_2',
	RHEL_7 = <any>'RHEL_7',
	Ubuntu_14 = <any>'Ubuntu_14',
	Ubuntu_16 = <any>'Ubuntu_16',
	Linux_64 = <any>'Linux_64',
	Linux_86 = <any>'Linux-86'
}
