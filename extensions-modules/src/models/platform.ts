/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

const unknown = 'unknown';

export enum Runtime {
	UnknownRuntime = <any>'Unknown',
	UnknownVersion = <any>'Unknown',
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

export function getRuntimeDisplayName(runtime: Runtime): string {
	switch (runtime) {
		case Runtime.Windows_64:
			return 'Windows';
		case Runtime.Windows_86:
			return 'Windows';
		case Runtime.OSX:
			return 'OSX';
		case Runtime.CentOS_7:
			return 'Linux';
		case Runtime.Debian_8:
			return 'Linux';
		case Runtime.Fedora_23:
			return 'Linux';
		case Runtime.OpenSUSE_13_2:
			return 'Linux';
		case Runtime.SLES_12_2:
			return 'Linux';
		case Runtime.RHEL_7:
			return 'Linux';
		case Runtime.Ubuntu_14:
			return 'Linux';
		case Runtime.Ubuntu_16:
			return 'Linux';
		case Runtime.Linux_64:
			return 'Linux';
		case Runtime.Linux_86:
			return 'Linux';
		default:
			return 'Unknown';
	}
}

export class PlatformInformation {
	public runtimeId: Runtime;

	public constructor(
		public platform: string,
		public architecture: string,
		public distribution: LinuxDistribution = undefined,
		public getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime) {
		try {
			this.runtimeId = this.getRuntimeId(platform, architecture, distribution);
		} catch (err) {
			this.runtimeId = undefined;
		}
	}

	public isWindows(): boolean {
		return this.platform === 'win32';
	}

	public isMacOS(): boolean {
		return this.platform === 'darwin';
	}

	public isLinux(): boolean {
		return this.platform === 'linux';
	}

	public isValidRuntime(): boolean {
		return this.runtimeId !== undefined && this.runtimeId !== Runtime.UnknownRuntime && this.runtimeId !== Runtime.UnknownVersion;
	}

	public getRuntimeDisplayName(): string {
		return getRuntimeDisplayName(this.runtimeId);
	}

	public toString(): string {
		let result = this.platform;

		if (this.architecture) {
			if (result) {
				result += ', ';
			}

			result += this.architecture;
		}

		if (this.distribution) {
			if (result) {
				result += ', ';
			}

			result += this.distribution.toString();
		}

		return result;
	}

	public static getCurrent(getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime,
		extensionName: string): Promise<any> {
		let platform = os.platform();
		let architecturePromise: Promise<string>;
		let distributionPromise: Promise<LinuxDistribution>;

		switch (platform) {
			case 'win32':
				architecturePromise = PlatformInformation.getWindowsArchitecture();
				distributionPromise = Promise.resolve(undefined);
				break;

			case 'darwin':
				let osVersion = os.release();
				if (parseFloat(osVersion) < 16.0 && extensionName === 'mssql') {
					return Promise.reject('The current version of macOS is not supported. Only macOS Sierra and above (>= 10.12) are supported.');
				}
				architecturePromise = PlatformInformation.getUnixArchitecture();
				distributionPromise = Promise.resolve(undefined);
				break;

			case 'linux':
				architecturePromise = PlatformInformation.getUnixArchitecture();
				distributionPromise = LinuxDistribution.getCurrent();
				break;

			default:
				return Promise.reject(`Unsupported platform: ${platform}`);
		}

		return architecturePromise.then(arch => {
			return distributionPromise.then(distro => {
				return new PlatformInformation(platform, arch, distro, getRuntimeId);
			});
		});
	}


	private static getWindowsArchitecture(): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			// try to get the architecture from WMIC
			PlatformInformation.getWindowsArchitectureWmic().then(architecture => {
				if (architecture && architecture !== unknown) {
					resolve(architecture);
				} else {
					// sometimes WMIC isn't available on the path so then try to parse the envvar
					PlatformInformation.getWindowsArchitectureEnv().then(architecture => {
						resolve(architecture);
					});
				}
			});
		});
	}

	private static getWindowsArchitectureWmic(): Promise<string> {
		return this.execChildProcess('wmic os get osarchitecture')
			.then(architecture => {
				if (architecture) {
					let archArray: string[] = architecture.split(os.EOL);
					if (archArray.length >= 2) {
						let arch = archArray[1].trim();

						// Note: This string can be localized. So, we'll just check to see if it contains 32 or 64.
						if (arch.indexOf('64') >= 0) {
							return 'x86_64';
						} else if (arch.indexOf('32') >= 0) {
							return 'x86';
						}
					}
				}

				return unknown;
			}).catch((error) => {
				return unknown;
			});
	}

	private static getWindowsArchitectureEnv(): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (process.env.PROCESSOR_ARCHITECTURE === 'x86' && process.env.PROCESSOR_ARCHITEW6432 === undefined) {
				resolve('x86');
			}
			else {
				resolve('x86_64');
			}
		});
	}

	private static getUnixArchitecture(): Promise<string> {
		return this.execChildProcess('uname -m')
			.then(architecture => {
				if (architecture) {
					return architecture.trim();
				}

				return undefined;
			});
	}

	private static execChildProcess(process: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			child_process.exec(process, { maxBuffer: 500 * 1024 }, (error: Error, stdout: string, stderr: string) => {
				if (error) {
					reject(error);
					return;
				}

				if (stderr && stderr.length > 0) {
					reject(new Error(stderr));
					return;
				}

				resolve(stdout);
			});
		});
	}
}

/**
 * There is no standard way on Linux to find the distribution name and version.
 * Recently, systemd has pushed to standardize the os-release file. This has
 * seen adoption in "recent" versions of all major distributions.
 * https://www.freedesktop.org/software/systemd/man/os-release.html
 */
export class LinuxDistribution {
	public constructor(
		public name: string,
		public version: string,
		public idLike?: string[]) { }

	public static getCurrent(): Promise<LinuxDistribution> {
		// Try /etc/os-release and fallback to /usr/lib/os-release per the synopsis
		// at https://www.freedesktop.org/software/systemd/man/os-release.html.
		return LinuxDistribution.fromFilePath('/etc/os-release')
			.catch(() => LinuxDistribution.fromFilePath('/usr/lib/os-release'))
			.catch(() => Promise.resolve(new LinuxDistribution(unknown, unknown)));
	}

	public toString(): string {
		return `name=${this.name}, version=${this.version}`;
	}

	private static fromFilePath(filePath: string): Promise<LinuxDistribution> {
		return new Promise<LinuxDistribution>((resolve, reject) => {
			fs.readFile(filePath, 'utf8', (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(LinuxDistribution.fromReleaseInfo(data));
				}
			});
		});
	}

	public static fromReleaseInfo(releaseInfo: string, eol: string = os.EOL): LinuxDistribution {
		let name = unknown;
		let version = unknown;
		let idLike: string[] = undefined;

		const lines = releaseInfo.split(eol);
		for (let line of lines) {
			line = line.trim();

			let equalsIndex = line.indexOf('=');
			if (equalsIndex >= 0) {
				let key = line.substring(0, equalsIndex);
				let value = line.substring(equalsIndex + 1);

				// Strip quotes if necessary
				if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
					value = value.substring(1, value.length - 1);
				} else if (value.length > 1 && value.startsWith('\'') && value.endsWith('\'')) {
					value = value.substring(1, value.length - 1);
				}

				if (key === 'ID') {
					name = value;
				} else if (key === 'VERSION_ID') {
					version = value;
				} else if (key === 'ID_LIKE') {
					idLike = value.split(' ');
				}

				if (name !== unknown && version !== unknown && idLike !== undefined) {
					break;
				}
			}
		}

		return new LinuxDistribution(name, version, idLike);
	}
}

