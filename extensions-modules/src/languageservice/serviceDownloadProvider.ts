/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Runtime, getRuntimeDisplayName } from '../models/platform';
import * as path from 'path';
import { IConfig, IStatusView, IPackage, PackageError, IHttpClient, IDecompressProvider } from './interfaces';
import { ILogger } from '../models/interfaces';
import { Constants } from '../models/constants';
import * as tmp from 'tmp';
import { IExtensionConstants } from '../models/contracts/contracts';

const fse = require('fs-extra');

/*
* Service Download Provider class which handles downloading the SQL Tools service.
*/
export default class ServiceDownloadProvider {

	constructor(private _config: IConfig,
		private _logger: ILogger,
		private _statusView: IStatusView,
		private _httpClient: IHttpClient,
		private _decompressProvider: IDecompressProvider,
		private _extensionConstants: IExtensionConstants,
		private _fromBuild: boolean) {
		// Ensure our temp files get cleaned up in case of error.
		tmp.setGracefulCleanup();
	}

	/**
	 * Returns the download url for given platform
	 */
	public getDownloadFileName(platform: Runtime): string {
		let fileNamesJson = this._config.getConfigValue('downloadFileNames');
		console.info('Platform: ', platform.toString());

		let fileName = fileNamesJson[platform.toString()];
		console.info('Filename: ', fileName);

		if (fileName === undefined) {
			if (process.platform === 'linux') {
				throw new Error('Unsupported linux distribution');
			} else {
				throw new Error(`Unsupported platform: ${process.platform}`);
			}
		}

		return fileName;
	}


	/**
	 * Returns SQL tools service installed folder.
	 */
	public getInstallDirectory(platform: Runtime, extensionConfigSectionName: string): string {
		let basePath = this.getInstallDirectoryRoot(platform, extensionConfigSectionName);
		let versionFromConfig = this._config.getPackageVersion();
		basePath = basePath.replace('{#version#}', versionFromConfig);
		basePath = basePath.replace('{#platform#}', getRuntimeDisplayName(platform));
		if (!fse.existsSync(basePath)) {
			fse.mkdirsSync(basePath);
		}

		return basePath;
	}

	private getLocalUserFolderPath(platform: Runtime): string {
		if (platform) {
			switch (platform) {
				case Runtime.Windows_64:
				case Runtime.Windows_86:
					return process.env.APPDATA;
				case Runtime.OSX:
					return process.env.HOME + '/Library/Preferences';
				default:
					return process.env.HOME;
			}
		}
	}

	/**
	 * Returns SQL tools service installed folder root.
	 */
	public getInstallDirectoryRoot(platform: Runtime, extensionConfigSectionName: string): string {
		let installDirFromConfig : string;
		installDirFromConfig = this._config.getInstallDirectory();
		if (!installDirFromConfig || installDirFromConfig === '') {
			let rootFolderName: string = '.sqlops';
			if (platform === Runtime.Windows_64 || platform === Runtime.Windows_86) {
				rootFolderName = 'sqlops';
			}
			installDirFromConfig = path.join(this.getLocalUserFolderPath(platform), `/${rootFolderName}/${this._extensionConstants.installFolderName}/{#version#}/{#platform#}`);
		}
		let basePath: string;
		if (path.isAbsolute(installDirFromConfig)) {
			basePath = installDirFromConfig;
		} else if (this._fromBuild) {
			basePath = path.join(__dirname, '../../../extensions/' + extensionConfigSectionName + '/' + installDirFromConfig);
		} else {
			// The path from config is relative to the out folder
			basePath = path.join(__dirname, '../../../../' + extensionConfigSectionName + '/' +  installDirFromConfig);
		}
		return basePath;
	}

	private getGetDownloadUrl(fileName: string): string {
		let baseDownloadUrl = this._config.getDownloadUrl();
		let version = this._config.getPackageVersion();
		baseDownloadUrl = baseDownloadUrl.replace('{#version#}', version);
		baseDownloadUrl = baseDownloadUrl.replace('{#fileName#}', fileName);
		return baseDownloadUrl;
	}

	/**
	 * Downloads the service and decompress it in the install folder.
	 */
	public installService(platform: Runtime): Promise<boolean> {
		const proxy = <string>this._config.getWorkspaceConfig('http.proxy');
		const strictSSL = this._config.getWorkspaceConfig('http.proxyStrictSSL', true);

		return new Promise<boolean>((resolve, reject) => {
			const fileName = this.getDownloadFileName(platform);
			const installDirectory = this.getInstallDirectory(platform, this._extensionConstants.extensionConfigSectionName);

			this._logger.appendLine(`${this._extensionConstants.serviceInstallingTo} ${installDirectory}.`);
			const urlString = this.getGetDownloadUrl(fileName);

			this._logger.appendLine(`${Constants.serviceDownloading} ${urlString}`);
			let pkg: IPackage = {
				installPath: installDirectory,
				url: urlString,
				tmpFile: undefined
			};
			this.createTempFile(pkg).then(tmpResult => {
				pkg.tmpFile = tmpResult;

				this._httpClient.downloadFile(pkg.url, pkg, this._logger, this._statusView, proxy, strictSSL).then(_ => {

					this._logger.logDebug(`Downloaded to ${pkg.tmpFile.name}...`);
					this._logger.appendLine(' Done!');
					this.install(pkg).then(result => {
						resolve(true);
					}).catch(installError => {
						reject(installError);
					});
				}).catch(downloadError => {
					this._logger.appendLine(`[ERROR] ${downloadError}`);
					reject(downloadError);
				});
			});
		});
	}

	private createTempFile(pkg: IPackage): Promise<tmp.SynchronousResult> {
		return new Promise<tmp.SynchronousResult>((resolve, reject) => {
			tmp.file({ prefix: 'package-' }, (err, path, fd, cleanupCallback) => {
				if (err) {
					return reject(new PackageError('Error from tmp.file', pkg, err));
				}

				resolve(<tmp.SynchronousResult>{ name: path, fd: fd, removeCallback: cleanupCallback });
			});
		});
	}

	private install(pkg: IPackage): Promise<void> {
		this._logger.appendLine('Installing ...');
		this._statusView.installingService();

		return new Promise<void>((resolve, reject) => {
			this._decompressProvider.decompress(pkg, this._logger).then(_ => {
				this._statusView.serviceInstalled();
				resolve();
			}).catch(err => {
				reject(err);
			});
		});
	}
}



