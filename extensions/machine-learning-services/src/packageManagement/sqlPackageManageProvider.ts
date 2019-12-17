/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import * as utils from '../common/utils';
import * as constants from '../common/constants';
import { QueryRunner } from '../common/queryRunner';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';

const installMode = 'install';
const uninstallMode = 'uninstall';
const localPythonProviderId = 'localhost_Pip';

/**
 * Manage Package Provider for python packages inside SQL server databases
 */
export class SqlPythonPackageManageProvider implements nbExtensionApis.IPackageManageProvider {

	private _pythonExecutable: string;

	public static ProviderId = 'sql_Python';

	/**
	 * Creates new a instance
	 */
	constructor(
		private _nbExtensionApis: nbExtensionApis.IExtensionApi,
		private _outputChannel: vscode.OutputChannel,
		private _rootFolder: string,
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService) {
		this._pythonExecutable = utils.getPythonExePath(this._rootFolder);
	}

	/**
	 * Returns provider Id
	 */
	public get providerId(): string {
		return SqlPythonPackageManageProvider.ProviderId;
	}

	/**
	 * Returns package target
	 */
	public get packageTarget(): nbExtensionApis.IPackageTarget {
		return { location: 'SQL', packageType: 'Python' };
	}

	/**
	 * Returns list of packages
	 */
	public async listPackages(): Promise<nbExtensionApis.IPackageDetails[]> {
		let packages = await this._queryRunner.getPythonPackages(await this.getCurrentConnection());
		if (packages) {
			packages = packages.sort((a, b) => a.name.localeCompare(b.name));
		} else {
			packages = [];
		}
		return packages;
	}

	/**
	 * Installs given packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	async installPackages(packages: nbExtensionApis.IPackageDetails[], useMinVersion: boolean): Promise<void> {
		if (packages) {

			// TODO: install package as parallel
			for (let index = 0; index < packages.length; index++) {
				const element = packages[index];
				await this.updatePackage(element, installMode);
			}
		}
		//TODO: use useMinVersion
		console.log(useMinVersion);
	}

	/**
	 * Execute a script to install or uninstall a python package inside current SQL Server connection
	 * @param packageDetails Packages to install or uninstall
	 * @param scriptMode can be 'install' or 'uninstall'
	 */
	private async updatePackage(packageDetails: nbExtensionApis.IPackageDetails, scriptMode: string): Promise<void> {
		let connection = await this.getCurrentConnection();
		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let port = '1433';
			let server = connection.serverName;
			let database = connection.databaseName ? `, database="${connection.databaseName}"` : '';
			let index = connection.serverName.indexOf(',');
			if (index > 0) {
				port = connection.serverName.substring(index + 1);
				server = connection.serverName.substring(0, index);
			}

			let pythonConnectionParts = `server="${server}", port=${port}, uid="${connection.userName}", pwd="${credentials[azdata.ConnectionOptionSpecialType.password]}"${database})`;
			let pythonCommandScript = scriptMode === installMode ?
				`pkgmanager.install(package="${packageDetails.name}", version="${packageDetails.version}")` :
				`pkgmanager.uninstall(package_name="${packageDetails.name}")`;

			let scripts: string[] = [
				'import sqlmlutils',
				`connection = sqlmlutils.ConnectionInfo(driver="ODBC Driver 17 for SQL Server", ${pythonConnectionParts}`,
				'pkgmanager = sqlmlutils.SQLPackageManager(connection)',
				pythonCommandScript
			];
			await this._processService.execScripts(this._pythonExecutable, scripts, this._outputChannel);
		}
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	async uninstallPackages(packages: nbExtensionApis.IPackageDetails[]): Promise<void> {
		for (let index = 0; index < packages.length; index++) {
			const element = packages[index];
			await this.updatePackage(element, uninstallMode);
		}
	}

	/**
	 * Returns true if the provider can be used
	 */
	async canUseProvider(): Promise<boolean> {
		let connection = await this.getCurrentConnection();
		if (connection && await this._queryRunner.isPythonInstalled(connection)) {
			return true;
		}
		return false;
	}

	/**
	 * Returns package overview for given name
	 * @param packageName Package Name
	 */
	async getPackageOverview(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
		let packagePreview: nbExtensionApis.IPackageOverview = {
			name: packageName,
			versions: [],
			summary: ''
		};
		let pythonPackageProvider = this.pythonPackageProvider;
		if (pythonPackageProvider) {
			packagePreview = await pythonPackageProvider.getPackageOverview(packageName);
		}
		return packagePreview;
	}

	/**
	 * Returns location title
	 */
	async getLocationTitle(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return `${connection.serverName} ${connection.databaseName ? connection.databaseName : ''}`;
		}
		return constants.packageManagerNoConnection;
	}

	private get pythonPackageProvider(): nbExtensionApis.IPackageManageProvider | undefined {
		let providers = this._nbExtensionApis.getPackageManagers();
		if (providers && providers.has(localPythonProviderId)) {
			return providers.get(localPythonProviderId);
		}
		return undefined;
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
