/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { SqlPythonPackageManageProvider } from './sqlPythonPackageManageProvider';
import * as utils from '../common/utils';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { isNullOrUndefined } from 'util';
import { SqlRPackageManageProvider } from './sqlRPackageManageProvider';
import { HttpClient } from '../common/httpClient';
import { PackageConfigModel } from '../configurations/packageConfigModel';
import { PackageManagementService } from './packageManagementService';

export class PackageManager {

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
		private _service: PackageManagementService,
		private _processService: ProcessService,
		private _config: Config,
		private _httpClient: HttpClient) {
		this._sqlPythonPackagePackageManager = new SqlPythonPackageManageProvider(this._outputChannel, this._apiWrapper, this._service, this._processService, this._config, this._httpClient);
		this._sqlRPackageManager = new SqlRPackageManageProvider(this._outputChannel, this._apiWrapper, this._service, this._processService, this._config, this._httpClient);
	}

	/**
	 * Initializes the instance and resister SQL package manager with manage package dialog
	 */
	public init(): void {
	}

	private async getPythonExecutable(): Promise<string> {
		return await this._config.getPythonExecutable(true);
	}

	private async getRExecutable(): Promise<string> {
		return await this._config.getRExecutable(true);
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
			let isPythonInstalled = await this._service.isPythonInstalled(connection);
			let isRInstalled = await this._service.isRInstalled(connection);
			let defaultProvider: SqlRPackageManageProvider | SqlPythonPackageManageProvider | undefined;
			if (connection && isPythonInstalled && this._sqlPythonPackagePackageManager.canUseProvider) {
				defaultProvider = this._sqlPythonPackagePackageManager;
			} else if (connection && isRInstalled && this._sqlRPackageManager.canUseProvider) {
				defaultProvider = this._sqlRPackageManager;
			}
			if (connection && defaultProvider) {

				await this.enableExternalScript();
				// Install dependencies
				//
				if (!this.dependenciesInstalled) {
					await this.installDependencies();
					this.dependenciesInstalled = true;
				}

				// Execute the command
				//
				this._apiWrapper.executeCommand(constants.managePackagesCommand, {
					defaultLocation: defaultProvider.packageTarget.location,
					defaultProviderId: defaultProvider.providerId
				});
			} else {
				const result = await this._apiWrapper.showInfoMessage(constants.managePackageCommandError, constants.learnMoreTitle);
				if (result === constants.learnMoreTitle) {
					await this._apiWrapper.openExternal(vscode.Uri.parse(constants.managePackagesDocs));
				}
			}
		} catch (err) {
			this._apiWrapper.showErrorMessage(err);
		}
	}

	public async enableExternalScript(): Promise<void> {
		let connection = await this.getCurrentConnection();
		if (!await this._service.enableExternalScriptConfig(connection)) {
			throw Error(constants.externalScriptsIsRequiredError);
		}
	}

	/**
	 * Installs dependencies for the extension
	 */
	public async installDependencies(): Promise<void> {
		await utils.executeTasks(this._apiWrapper, constants.installPackageMngDependenciesMsgTaskName, [
			this.installRequiredPythonPackages(this._config.requiredSqlPythonPackages),
			this.installRequiredRPackages()], true);
	}

	private async installRequiredRPackages(): Promise<void> {
		if (!this._config.rEnabled) {
			return;
		}
		let rExecutable = await this.getRExecutable();
		if (!rExecutable) {
			throw new Error(constants.rConfigError);
		}

		await utils.createFolder(utils.getRPackagesFolderPath(this._rootFolder));
		const packages = this._config.requiredSqlRPackages.filter(p => !p.platform || p.platform === process.platform);
		await Promise.all(packages.map(x => this.installRPackage(x)));
	}

	/**
	 * Installs required python packages
	 */
	public async installRequiredPythonPackages(requiredPackages: PackageConfigModel[]): Promise<void> {
		if (!this._config.pythonEnabled) {
			return;
		}
		let pythonExecutable = await this.getPythonExecutable();
		if (!pythonExecutable) {
			throw new Error(constants.pythonConfigError);
		}
		if (!requiredPackages || requiredPackages.length === 0) {
			return;
		}

		let installedPackages = await this.getInstalledPipPackages();
		let fileContent = '';
		requiredPackages.forEach(packageDetails => {
			let hasVersion = ('version' in packageDetails) && !isNullOrUndefined(packageDetails['version']) && packageDetails['version'].length > 0;
			if (!installedPackages.find(x => x.name === packageDetails['name']
				&& (!hasVersion || utils.comparePackageVersions(packageDetails['version'] || '', x.version) <= 0))) {
				let packageNameDetail = hasVersion ? `${packageDetails.name}==${packageDetails.version}` : `${packageDetails.name}`;
				fileContent = `${fileContent}${packageNameDetail}\n`;
			}
		});

		if (fileContent) {
			this._apiWrapper.showInfoMessage(constants.confirmInstallPythonPackagesDetails(fileContent));
			let confirmed = await utils.promptConfirm(constants.confirmInstallPythonPackages, this._apiWrapper);
			if (confirmed) {
				this._outputChannel.appendLine(constants.installDependenciesPackages);
				let result = await utils.execCommandOnTempFile<string>(fileContent, async (tempFilePath) => {
					return await this.installPipPackage(tempFilePath);
				});
				this._outputChannel.appendLine(result);

			} else {
				throw Error(constants.requiredPackagesNotInstalled);
			}
		} else {
			this._outputChannel.appendLine(constants.installDependenciesPackagesAlreadyInstalled);
		}
	}

	private async getInstalledPipPackages(): Promise<nbExtensionApis.IPackageDetails[]> {
		try {
			let pythonExecutable = await this.getPythonExecutable();
			let cmd = `"${pythonExecutable}" -m pip list --format=json`;
			let packagesInfo = await this._processService.executeBufferedCommand(cmd, undefined);
			let packagesResult: nbExtensionApis.IPackageDetails[] = [];
			if (packagesInfo && packagesInfo.indexOf(']') > 0) {
				packagesResult = <nbExtensionApis.IPackageDetails[]>JSON.parse(packagesInfo.substr(0, packagesInfo.indexOf(']') + 1));
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
		let pythonExecutable = await this.getPythonExecutable();
		let cmd = `"${pythonExecutable}" -m pip install -r "${requirementFilePath}"`;
		return await this._processService.executeBufferedCommand(cmd, this._outputChannel);
	}

	private async installRPackage(model: PackageConfigModel): Promise<string> {
		let output = '';
		let cmd = '';
		let rExecutable = await this.getRExecutable();
		if (model.downloadUrl) {
			const packageFile = utils.getPackageFilePath(this._rootFolder, model.fileName || model.name);
			const packageExist = await utils.exists(packageFile);
			if (!packageExist) {
				await this._httpClient.download(model.downloadUrl, packageFile, this._outputChannel);
			}
			cmd = `"${rExecutable}" CMD INSTALL ${packageFile}`;
			output = await this._processService.executeBufferedCommand(cmd, this._outputChannel);
		} else if (model.repository) {
			cmd = `"${rExecutable}" -e "install.packages('${model.name}', repos='${model.repository}')"`;
			output = await this._processService.executeBufferedCommand(cmd, this._outputChannel);
		}
		return output;
	}
}
