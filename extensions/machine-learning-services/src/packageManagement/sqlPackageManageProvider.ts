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

const installMode = 'install';
const uninstallMode = 'uninstall';
const localPythonProviderId = 'localhost_Pip';

const updatePackageScript = `
import sys
import os

database = "#DATABASE#"
username = "#USER#"
password = "#PASSWORD#"
server = "#SERVER#"
port = #PORT#
package_name = "#PACKAGE_NAME#"
package_version = "#PACKAGE_VERSION#"
script_mode = "#SCRIPT_MODE#"
packages_path = r"#PYTHON_LOCATION#"

import sqlmlutils

connection = sqlmlutils.ConnectionInfo(driver="ODBC Driver 17 for SQL Server", server=server, port=port, uid=username, pwd=password, database=database)
sqlpy = sqlmlutils.SQLPythonExecutor(connection)
pkgmanager = sqlmlutils.SQLPackageManager(connection)
if script_mode == "${installMode}":
	pkgmanager.install(package=package_name, version=package_version);
else:
	pkgmanager.uninstall(package_name=package_name);
`;

/**
 * Manage Package Provider for python packages inside SQL server databases
 */
export class SqlPythonPackageManageProvider implements nbExtensionApis.IPackageManageProvider {

	private _pythonInstallationLocation: string;
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
		private _queryRunner: QueryRunner) {
		this._pythonInstallationLocation = utils.getPythonInstallationLocation(this._rootFolder);
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
			for (let index = 0; index < packages.length; index++) {
				const element = packages[index];
				await this.updatePackage(element, installMode);
			}
		}
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
			let script = updatePackageScript;
			let port = '1433';
			let server = connection.serverName;
			let database = connection.databaseName ? connection.databaseName : 'master';
			let index = connection.serverName.indexOf(',');
			if (index > 0) {
				port = connection.serverName.substring(index + 1);
				server = connection.serverName.substring(0, index);
			}
			script = script.replace('#SERVER#', server);
			script = script.replace('#PORT#', port);
			script = script.replace('#DATABASE#', database);
			script = script.replace('#USER#', connection.userName);
			script = script.replace('#PACKAGE_NAME#', packageDetails.name);
			script = script.replace('#PACKAGE_VERSION#', packageDetails.version);
			script = script.replace('#SCRIPT_MODE#', scriptMode);
			script = script.replace('#PYTHON_LOCATION#', this._pythonInstallationLocation);
			script = script.replace('#PASSWORD#', credentials[azdata.ConnectionOptionSpecialType.password]);

			await utils.execCommandOnTempFile<void>(script, async (tempFilePath) => {
				let result = await this.runPythonCommand(`${tempFilePath}`);
				this._outputChannel.appendLine(result);
			});
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
	getPackageOverview(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
		let pythonPackageProvider = this.pythonPackageProvider;
		if (pythonPackageProvider) {
			return pythonPackageProvider.getPackageOverview(packageName);
		}
		return Promise.resolve(undefined);
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

	private get jupyterInstallation(): nbExtensionApis.IJupyterServerInstallation {
		return this._nbExtensionApis.getJupyterController().jupyterInstallation;
	}

	private get pythonPackageProvider(): nbExtensionApis.IPackageManageProvider {
		let providers = this._nbExtensionApis.getPackageManagers();
		if (providers && providers.has(localPythonProviderId)) {
			return providers.get(localPythonProviderId);
		}
		return undefined;
	}

	private async runPythonCommand(cmd: string): Promise<string> {
		try {
			let commandToRun = `"${this._pythonExecutable}" ${cmd}`;
			return await this.jupyterInstallation.executeBufferedCommand(commandToRun);
		}
		catch (err) {
			throw err;
		}
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
