/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';

import { QueryRunner } from '../common/queryRunner';
import { ApiWrapper } from '../common/apiWrapper';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { SqlPackageManageProviderBase, ScriptMode } from './SqlPackageManageProviderBase';



/**
 * Manage Package Provider for r packages inside SQL server databases
 */
export class SqlRPackageManageProvider extends SqlPackageManageProviderBase implements nbExtensionApis.IPackageManageProvider {

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
	protected async fetchPackages(): Promise<nbExtensionApis.IPackageDetails[]> {
		return await this._queryRunner.getRPackages(await this.getCurrentConnection());
	}

	/**
	 * Execute a script to install or uninstall a r package inside current SQL Server connection
	 * @param packageDetails Packages to install or uninstall
	 * @param scriptMode can be 'install' or 'uninstall'
	 */
	protected async executeScripts(scriptMode: ScriptMode, packageDetails: nbExtensionApis.IPackageDetails): Promise<void> {
		let connection = await this.getCurrentConnection();
		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let database = connection.databaseName ? `, database="${connection.databaseName}"` : '';
			let connectionParts = `server="${connection.serverName}", uid="${connection.userName}", pwd="${credentials[azdata.ConnectionOptionSpecialType.password]}"${database}`;
			let rCommandScript = scriptMode === ScriptMode.Install ? 'sql_install.packages' : 'sql_remove.packages';

			let scripts: string[] = [
				'formals(quit)$save <- formals(q)$save <- "no"',
				'library(sqlmlutils)',
				`connection <- connectionInfo(${connectionParts})`,
				`pkgs <- c("${packageDetails.name}")`,
				`${rCommandScript}(connectionString = connection, pkgs, scope = "PUBLIC")`,
				'q()'
			];
			let rExecutable = this._config.rExecutable;
			await this._processService.execScripts(`${rExecutable}`, scripts, ['--vanilla'], this._outputChannel);
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
	protected async fetchPackage(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
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
