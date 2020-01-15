/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { QueryRunner } from '../common/queryRunner';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { SqlPackageManageProviderBase } from './SqlPackageManageProviderBase';
import { HttpClient } from '../common/httpClient';
import * as utils from '../common/utils';

const installMode = 'install';
const uninstallMode = 'uninstall';

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
		private _queryRunner: QueryRunner,
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
			let pythonExecutable = this._config.pythonExecutable;
			await this._processService.execScripts(pythonExecutable, scripts, [], this._outputChannel);
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
		let packagePreview: nbExtensionApis.IPackageOverview = await this.fetchPypiPackage(packageName);
		return packagePreview;
	}

	private getPackageLink(packageName: string): string {
		return `https://pypi.org/pypi/${packageName}/json`;
	}

	private async fetchPypiPackage(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
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
