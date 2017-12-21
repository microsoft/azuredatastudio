/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Runtime, PlatformInformation } from '../models/platform';
import Config from '../configurations/config';
import ServiceDownloadProvider from './serviceDownloadProvider';
import DecompressProvider from './decompressProvider';
import HttpClient from './httpClient';
import ServerProvider from './server';
import { IStatusView } from './interfaces';
import { ILogger } from '../models/interfaces';
import { IExtensionConstants } from '../models/contracts/contracts';

class StubStatusView implements IStatusView {
	installingService(): void {
		console.log('...');
	}
	serviceInstalled(): void {
		console.log('Service installed');
	}
	serviceInstallationFailed(): void {
		console.log('Service installation failed');
	}
	updateServiceDownloadingProgress(downloadPercentage: number): void {
		if (downloadPercentage === 100) {
			process.stdout.write('100%');
		}
	}
}

class StubLogger implements ILogger {
	logDebug(message: string): void {
		console.log(message);
	}

	increaseIndent(): void {
		console.log('increaseIndent');
	}

	decreaseIndent(): void {
		console.log('decreaseIndent');
	}

	append(message?: string): void {
		process.stdout.write(message);
	}
	appendLine(message?: string): void {
		console.log(message);
	}
}

export class ServiceInstaller {
	private _config = undefined;
	private _logger = new StubLogger();
	private _statusView = new StubStatusView();
	private _httpClient = new HttpClient();
	private _decompressProvider = new DecompressProvider();
	private _downloadProvider = undefined;
	private _serverProvider = undefined;
	private _extensionConstants = undefined;

	constructor(extensionConstants: IExtensionConstants, path?: string) {
		this._extensionConstants = extensionConstants;
		this._config = new Config(extensionConstants.extensionConfigSectionName, path, true);
		this._downloadProvider = new ServiceDownloadProvider(this._config, this._logger, this._statusView, this._httpClient, this._decompressProvider, extensionConstants, true);
		this._serverProvider = new ServerProvider(this._downloadProvider, this._config, this._statusView, extensionConstants.extensionConfigSectionName);
	}
	/*
	* Installs the service for the given platform if it's not already installed.
	*/
	public installService(): Promise<String> {
		return PlatformInformation.getCurrent(this._extensionConstants.getRuntimeId, this._extensionConstants.extensionName).then(platformInfo => {
			if (platformInfo.isValidRuntime()) {
				return this._serverProvider.getOrDownloadServer(platformInfo.runtimeId);
			} else {
				throw new Error('unsupported runtime');
			}
		});
	}

	/*
	* Returns the install folder path for given platform.
	*/
	public getServiceInstallDirectory(runtime: Runtime): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (runtime === undefined) {
				PlatformInformation.getCurrent(this._extensionConstants.getRuntimeId, this._extensionConstants.extensionName).then(platformInfo => {
					if (platformInfo.isValidRuntime()) {
						resolve(this._downloadProvider.getInstallDirectory(platformInfo.runtimeId));
					} else {
						reject('unsupported runtime');
					}
				}).catch(error => {
					reject(error);
				});
			} else {
				resolve(this._downloadProvider.getInstallDirectory(runtime));
			}
		});

	}

	/*
	* Returns the path to the root folder of service install location.
	*/
	public getServiceInstallDirectoryRoot(runtime: Runtime): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (runtime === undefined) {
				PlatformInformation.getCurrent(this._extensionConstants.getRuntimeId, this._extensionConstants.extensionName).then(platformInfo => {
					if (platformInfo.isValidRuntime()) {
						let directoryPath: string = this._downloadProvider.getInstallDirectoryRoot(platformInfo, this._extensionConstants.extensionName);
						directoryPath = directoryPath.replace('\\{#version#}', '');
						directoryPath = directoryPath.replace('\\{#platform#}', '');
						directoryPath = directoryPath.replace('/{#platform#}', '');
						directoryPath = directoryPath.replace('/{#version#}', '');
						resolve(directoryPath);
					} else {
						reject('unsupported runtime');
					}
				}).catch(error => {
					reject(error);
				});
			} else {
				resolve(this._downloadProvider.getInstallDirectory(runtime));
			}
		});
	}
}
