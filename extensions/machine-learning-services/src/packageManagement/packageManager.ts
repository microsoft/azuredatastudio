/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { SqlPythonPackageManageProvider } from './sqlPythonPackageManageProvider';
import { QueryRunner } from '../common/queryRunner';
import * as utils from '../common/utils';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { isNullOrUndefined } from 'util';
import { SqlRPackageManageProvider } from './sqlRPackageManageProvider';
import { HttpClient } from '../common/httpClient';
import { PackageConfigModel } from '../configurations/packageConfigModel';

export class PackageManager {

	private _pythonExecutable: string = '';
	private _rExecutable: string = '';
	private _sqlPythonPackagePackageManager: SqlPythonPackageManageProvider;
	private _sqlRPackageManager: SqlRPackageManageProvider;
	public dependenciesInstalled: boolean = false;

	/**
	 * Creates a new instance of PackageManager
	 */
	constructor(
		private _outputChannel: vscode.OutputChannel,
		private _rootFolder: string,
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService,
		private _config: Config,
		private _httpClient: HttpClient) {
		this._sqlPythonPackagePackageManager = new SqlPythonPackageManageProvider(this._outputChannel, this._apiWrapper, this._queryRunner, this._processService, this._config, this._httpClient);
		this._sqlRPackageManager = new SqlRPackageManageProvider(this._outputChannel, this._apiWrapper, this._queryRunner, this._processService, this._config, this._httpClient);
	}

	/**
	 * Initializes the instance and resister SQL package manager with manage package dialog
	 */
	public init(): void {
		this._pythonExecutable = this._config.pythonExecutable;
		this._rExecutable = this._config.rExecutable;
	}

	/**
	 * Returns packageManageProviders
	 */
	public get packageManageProviders(): nbExtensionApis.IPackageManageProvider[] {
		return [
			this._sqlPythonPackagePackageManager,
			this._sqlRPackageManager
		];
	}

	/**
	 * Executes manage package command for SQL server packages.
	 */
	public async managePackages(): Promise<void> {
		try {
			// Only execute the command if there's a valid connection with ml configuration enabled
			//
			let connection = await this.getCurrentConnection();
			let isPythonInstalled = await this._queryRunner.isPythonInstalled(connection);
			let isRInstalled = await this._queryRunner.isRInstalled(connection);
			let defaultProvider: SqlRPackageManageProvider | SqlPythonPackageManageProvider | undefined;
			if (connection && isPythonInstalled) {
				defaultProvider = this._sqlPythonPackagePackageManager;
			} else if (connection && isRInstalled) {
				defaultProvider = this._sqlRPackageManager;
			}
			if (connection && defaultProvider) {

				// Install dependencies
				//
				if (!this.dependenciesInstalled) {
					this._apiWrapper.showInfoMessage(constants.installingDependencies);
					await this.installDependencies();
					this.dependenciesInstalled = true;
				}

				// Execute the command
				//
				this._apiWrapper.executeCommand(constants.managePackagesCommand, {
					multiLocations: false,
					defaultLocation: defaultProvider.packageTarget.location,
					defaultProviderId: defaultProvider.providerId
				});
			} else {
				this._apiWrapper.showInfoMessage(constants.managePackageCommandError);
			}
		} catch (err) {
			this._outputChannel.appendLine(err);
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
						await utils.createFolder(utils.getRPackagesFolderPath(this._rootFolder));

						// Install required packages
						//
						await Promise.all([
							this.installRequiredPythonPackages(),
							this.installRequiredRPackages(op)]);
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

	private async installRequiredRPackages(startBackgroundOperation: azdata.BackgroundOperation): Promise<void> {
		if (!this._config.rEnabled) {
			return;
		}
		if (!this._rExecutable) {
			throw new Error(constants.rConfigError);
		}

		await Promise.all(this._config.requiredRPackages.map(x => this.installRPackage(x, startBackgroundOperation)));
	}

	/**
	 * Installs required python packages
	 */
	private async installRequiredPythonPackages(): Promise<void> {
		if (!this._config.pythonEnabled) {
			return;
		}
		if (!this._pythonExecutable) {
			throw new Error(constants.pythonConfigError);
		}
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
				return await this.installPipPackage(tempFilePath);
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

	private async installPipPackage(requirementFilePath: string): Promise<string> {
		let cmd = `"${this._pythonExecutable}" -m pip install -r "${requirementFilePath}"`;
		return await this._processService.executeBufferedCommand(cmd, this._outputChannel);
	}

	private async installRPackage(model: PackageConfigModel, startBackgroundOperation: azdata.BackgroundOperation): Promise<string> {
		let output = '';
		let cmd = '';
		if (model.downloadUrl) {
			const packageFile = utils.getPackageFilePath(this._rootFolder, model.fileName || model.name);
			const packageExist = await utils.exists(packageFile);
			if (!packageExist) {
				await this._httpClient.download(model.downloadUrl, packageFile, startBackgroundOperation, this._outputChannel);
			}
			cmd = `"${this._rExecutable}" CMD INSTALL ${packageFile}`;
			output = await this._processService.executeBufferedCommand(cmd, this._outputChannel);
		} else if (model.repository) {
			cmd = `"${this._rExecutable}" -e "install.packages('${model.name}', repos='${model.repository}')"`;
			output = await this._processService.executeBufferedCommand(cmd, this._outputChannel);
		}
		return output;
	}
}
