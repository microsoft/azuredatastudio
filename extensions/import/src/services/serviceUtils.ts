/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

const baseConfig = require('./config.json');

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

export function generateUserId(): Promise<string> {
	return new Promise<string>(resolve => {
		try {
			let interfaces = os.networkInterfaces();
			let mac;
			for (let key of Object.keys(interfaces)) {
				let item = interfaces[key][0];
				if (!item.internal) {
					mac = item.mac;
					break;
				}
			}
			if (mac) {
				resolve(crypto.createHash('sha256').update(mac + os.homedir(), 'utf8').digest('hex'));
			} else {
				resolve(generateGuid());
			}
		} catch (err) {
			resolve(generateGuid()); // fallback
		}
	});
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
	let oct: string = '';
	let tmp: number;
	/* tslint:disable:no-bitwise */
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}

	// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	/* tslint:enable:no-bitwise */
}

export function verifyPlatform(): Thenable<boolean> {
	if (os.platform() === 'darwin' && parseFloat(os.release()) < 16.0) {
		return Promise.resolve(false);
	} else {
		return Promise.resolve(true);
	}
}

export function getServiceInstallConfig(basePath?: string): any {
	if (!basePath) {
		basePath = __dirname;
	}
	let config = JSON.parse(JSON.stringify(baseConfig));
	config.installDirectory = path.join(basePath, config.installDirectory);

	return config;
}

export function getResolvedServiceInstallationPath(runtime: Runtime, basePath?: string): string {
	let config = getServiceInstallConfig(basePath);
	let dir = config.installDirectory;
	dir = dir.replace('{#version#}', config.version);
	dir = dir.replace('{#platform#}', getRuntimeDisplayName(runtime));

	return dir;
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
