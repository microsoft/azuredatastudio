/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { SqlPackageManageProviderBase, ScriptMode } from './packageManageProviderBase';
import { HttpClient } from '../common/httpClient';
import * as utils from '../common/utils';
import { PackageManagementService } from './packageManagementService';

/**
 * Manage Package Provider for python packages inside SQL server databases
 */
export class SqlPythonPackageManageProvider extends SqlPackageManageProviderBase implements nbExtensionApis.IPackageManageProvider {
	public static ProviderId = 'sql_Python';

	/**
	 * Creates new a instance
	 */
	constructor(
		private _outputChannel: vscode.OutputChannel,
		apiWrapper: ApiWrapper,
		private _service: PackageManagementService,
		private _processService: ProcessService,
		private _config: Config,
		private _httpClient: HttpClient) {
		super(apiWrapper);
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
	protected async fetchPackages(databaseName: string): Promise<nbExtensionApis.IPackageDetails[]> {
		return await this._service.getPythonPackages(await this.getCurrentConnection(), databaseName);
	}

	/**
	 * Execute a script to install or uninstall a python package inside current SQL Server connection
	 * @param packageDetails Packages to install or uninstall
	 * @param scriptMode can be 'install' or 'uninstall'
	 */
	protected async executeScripts(scriptMode: ScriptMode, packageDetails: nbExtensionApis.IPackageDetails, databaseName: string): Promise<void> {
		let connection = await this.getCurrentConnection();
		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let port = '1433';
			let server = connection.serverName;
			let database = databaseName ? `, database="${databaseName}"` : '';
			const auth = connection.userName ? `, uid="${connection.userName}", pwd="${credentials[azdata.ConnectionOptionSpecialType.password]}"` : '';
			let index = connection.serverName.indexOf(',');
			if (index > 0) {
				port = connection.serverName.substring(index + 1);
				server = connection.serverName.substring(0, index);
			}

			let pythonConnectionParts = `server="${server}", port=${port}${auth}${database})`;
			let pythonCommandScript = scriptMode === ScriptMode.Install ?
				`pkgmanager.install(package="${packageDetails.name}", version="${packageDetails.version}")` :
				`pkgmanager.uninstall(package_name="${packageDetails.name}")`;

			let scripts: string[] = [
				'import sqlmlutils',
				`connection = sqlmlutils.ConnectionInfo(driver="ODBC Driver 17 for SQL Server", ${pythonConnectionParts}`,
				'pkgmanager = sqlmlutils.SQLPackageManager(connection)',
				pythonCommandScript
			];
			let pythonExecutable = await this._config.getPythonExecutable(true);
			await this._processService.execScripts(pythonExecutable, scripts, [], this._outputChannel);
		}
	}

	/**
	 * Returns true if the provider can be used
	 */
	async canUseProvider(): Promise<boolean> {
		if (!this._config.pythonEnabled) {
			return false;
		}
		let connection = await this.getCurrentConnection();
		if (connection && await this._service.isPythonInstalled(connection)) {
			return true;
		}
		return false;
	}

	private getPackageLink(packageName: string): string {
		return `https://pypi.org/pypi/${packageName}/json`;
	}

	protected async fetchPackage(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
		let body = await this._httpClient.fetch(this.getPackageLink(packageName));
		let packagesJson = JSON.parse(body);
		let versionNums: string[] = [];
		let packageSummary = '';
		if (packagesJson) {
			if (packagesJson.releases) {
				let versionKeys = Object.keys(packagesJson.releases);
				versionKeys = versionKeys.filter(versionKey => {
					let releaseInfo = packagesJson.releases[versionKey];
					return Array.isArray(releaseInfo) && releaseInfo.length > 0;
				});
				versionNums = utils.sortPackageVersions(versionKeys, false);
			}

			if (packagesJson.info && packagesJson.info.summary) {
				packageSummary = packagesJson.info.summary;
			}
		}

		return {
			name: packageName,
			versions: versionNums,
			summary: packageSummary
		};
	}
}
