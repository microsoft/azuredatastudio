/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { SqlPythonPackageManageProvider } from './sqlPackageManageProvider';
import { QueryRunner } from '../common/queryRunner';
import * as utils from '../common/utils';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';
import { Config } from '../common/config';
import { isNullOrUndefined } from 'util';

export class PackageManager {

	private _pythonExecutable: string = '';
	private _pythonInstallationLocation: string = '';
	private _sqlPackageManager: SqlPythonPackageManageProvider | undefined = undefined;

	/**
	 * Creates a new instance of PackageManager
	 */
	constructor(
		private _nbExtensionApis: nbExtensionApis.IExtensionApi,
		private _outputChannel: vscode.OutputChannel,
		private _rootFolder: string,
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService,
		private _config: Config) {
	}

	/**
	 * Initializes the instance and resister SQL package manager with manage package dialog
	 */
	public init(): void {
		this._pythonInstallationLocation = utils.getPythonInstallationLocation(this._rootFolder);
		this._pythonExecutable = utils.getPythonExePath(this._rootFolder);
		this._sqlPackageManager = new SqlPythonPackageManageProvider(this._nbExtensionApis, this._outputChannel, this._rootFolder, this._apiWrapper, this._queryRunner, this._processService);
		this._nbExtensionApis.registerPackageManager(SqlPythonPackageManageProvider.ProviderId, this._sqlPackageManager);
	}

	/**
	 * Executes manage package command for SQL server packages.
	 */
	public async managePackages(): Promise<void> {

		// Only execute the command if there's a valid connection with ml configuration enabled
		//
		let connection = await this.getCurrentConnection();
		let isPythonInstalled = await this._queryRunner.isPythonInstalled(connection);
		if (connection && isPythonInstalled && this._sqlPackageManager) {
			this._apiWrapper.executeCommand(constants.managePackagesCommand, {
				multiLocations: false,
				defaultLocation: this._sqlPackageManager.packageTarget.location,
				defaultProviderId: SqlPythonPackageManageProvider.ProviderId
			});
		} else {
			this._apiWrapper.showInfoMessage(constants.managePackageCommandError);
		}
	}

	/**
	 * Installs dependencies for the extension
	 */
	public async installDependencies(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let msgTaskName = constants.installDependenciesMsgTaskName;
			this._apiWrapper.startBackgroundOperation({
				displayName: msgTaskName,
				description: msgTaskName,
				isCancelable: false,
				operation: async op => {
					try {
						if (!(await utils.exists(this._pythonExecutable))) {
							// Install python
							//
							await utils.createFolder(this._pythonInstallationLocation);
							await this.jupyterInstallation.installPythonPackage(op, false, this._pythonInstallationLocation, this._outputChannel);
						}

						// Install required packages
						//
						await this.installRequiredPythonPackages();
						op.updateStatus(azdata.TaskStatus.Succeeded);
						resolve();
					} catch (error) {
						let errorMsg = constants.installDependenciesError(error ? error.message : '');
						op.updateStatus(azdata.TaskStatus.Failed, errorMsg);
						reject(errorMsg);
					}
				}
			});
		});
	}

	/**
	 * Installs required python packages
	 */
	private async installRequiredPythonPackages(): Promise<void> {
		let installedPackages = await this.getInstalledPipPackages();
		let fileContent = '';
		this._config.requiredPythonPackages.forEach(packageDetails => {
			let hasVersion = ('version' in packageDetails) && !isNullOrUndefined(packageDetails['version']) && packageDetails['version'].length > 0;
			if (!installedPackages.find(x => x.name === packageDetails['name'] && (!hasVersion || packageDetails['version'] === x.version))) {
				let packageNameDetail = hasVersion ? `${packageDetails.name}==${packageDetails.version}` : `${packageDetails.name}`;
				fileContent = `${fileContent}${packageNameDetail}\n`;
			}
		});

		if (fileContent) {
			this._outputChannel.appendLine(constants.installDependenciesPackages);
			let result = await utils.execCommandOnTempFile<string>(fileContent, async (tempFilePath) => {
				return await this.installPackages(tempFilePath);
			});
			this._outputChannel.appendLine(result);
		} else {
			this._outputChannel.appendLine(constants.installDependenciesPackagesAlreadyInstalled);
		}
	}

	private async getInstalledPipPackages(): Promise<nbExtensionApis.IPackageDetails[]> {
		try {
			let cmd = `"${this._pythonExecutable}" -m pip list --format=json`;
			let packagesInfo = await this._processService.executeBufferedCommand(cmd, this._outputChannel);
			let packagesResult: nbExtensionApis.IPackageDetails[] = [];
			if (packagesInfo) {
				packagesResult = <nbExtensionApis.IPackageDetails[]>JSON.parse(packagesInfo);
			}
			return packagesResult;
		}
		catch (err) {
			this._outputChannel.appendLine(constants.installDependenciesGetPackagesError(err ? err.message : ''));
			return [];
		}
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	private get jupyterInstallation(): nbExtensionApis.IJupyterServerInstallation {
		return this._nbExtensionApis.getJupyterController().jupyterInstallation;
	}

	private async installPackages(requirementFilePath: string): Promise<string> {
		let cmd = `"${this._pythonExecutable}" -m pip install -r "${requirementFilePath}"`;
		return await this._processService.executeBufferedCommand(cmd, this._outputChannel);
	}
}
