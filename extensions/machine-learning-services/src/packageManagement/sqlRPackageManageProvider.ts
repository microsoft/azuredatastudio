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
import { SqlPackageManageProviderBase } from './SqPackageManageProviderBase';

const installMode = 'install';
const uninstallMode = 'uninstall';

/**
 * Manage Package Provider for python packages inside SQL server databases
 */
export class SqlRPackageManageProvider extends SqlPackageManageProviderBase implements nbExtensionApis.IPackageManageProvider {

	private _rExecutable: string;

	public static ProviderId = 'sql_R';

	/**
	 * Creates new a instance
	 */
	constructor(
		private _outputChannel: vscode.OutputChannel,
		apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService,
		private _config: Config) {
		super(apiWrapper);
		this._rExecutable = this._config.rExecutable;
	}

	/**
	 * Returns provider Id
	 */
	public get providerId(): string {
		return SqlRPackageManageProvider.ProviderId;
	}

	/**
	 * Returns package target
	 */
	public get packageTarget(): nbExtensionApis.IPackageTarget {
		return { location: 'SQL', packageType: 'R' };
	}

	/**
	 * Returns list of packages
	 */
	public async listPackages(): Promise<nbExtensionApis.IPackageDetails[]> {
		let packages = await this._queryRunner.getRPackages(await this.getCurrentConnection());
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
				await this.executeScripts(installMode, element);
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
	private async executeScripts(scriptMode: string, packageDetails: nbExtensionApis.IPackageDetails): Promise<void> {
		let connection = await this.getCurrentConnection();
		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let database = connection.databaseName ? `, database="${connection.databaseName}"` : '';
			let pythonConnectionParts = `server="${connection.serverName}", uid="${connection.userName}", pwd="${credentials[azdata.ConnectionOptionSpecialType.password]}"${database}`;
			let rCommandScript = scriptMode === installMode ? 'sql_install.packages' : 'sql_remove.packages';

			let scripts: string[] = [
				'formals(quit)$save <- formals(q)$save <- "no"',
				'library(sqlmlutils)',
				`connection <- connectionInfo(${pythonConnectionParts})`,
				`pkgs <- c("${packageDetails.name}")`,
				`${rCommandScript}(connectionString = connection, pkgs, scope = "PUBLIC")`,
				'q()'
			];
			await this._processService.execScripts(`${this._rExecutable}`, scripts, ['--vanilla'], this._outputChannel);
		}
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	async uninstallPackages(packages: nbExtensionApis.IPackageDetails[]): Promise<void> {
		for (let index = 0; index < packages.length; index++) {
			const element = packages[index];
			await this.executeScripts(uninstallMode, element);
		}
	}

	/**
	 * Returns true if the provider can be used
	 */
	async canUseProvider(): Promise<boolean> {
		let connection = await this.getCurrentConnection();
		if (connection && await this._queryRunner.isRInstalled(connection)) {
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
		let connection = await this.getCurrentConnection();
		let availablePackages = await this._queryRunner.getRAvailablePackages(connection);
		let versions = availablePackages.filter(x => x.name === packageName).map(x => x.version);
		packagePreview.versions = versions;
		return packagePreview;
	}


}
