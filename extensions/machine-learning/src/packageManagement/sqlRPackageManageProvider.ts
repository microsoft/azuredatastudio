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
import * as constants from '../common/constants';
import { PackageManagementService } from './packageManagementService';



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
	protected async fetchPackages(databaseName: string): Promise<nbExtensionApis.IPackageDetails[]> {
		return await this._service.getRPackages(await this.getCurrentConnection(), databaseName);
	}

	/**
	 * Execute a script to install or uninstall a r package inside current SQL Server connection
	 * @param packageDetails Packages to install or uninstall
	 * @param scriptMode can be 'install' or 'uninstall'
	 */
	protected async executeScripts(scriptMode: ScriptMode, packageDetails: nbExtensionApis.IPackageDetails, databaseName: string): Promise<void> {
		let connection = await this.getCurrentConnection();
		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let server = connection.serverName.replace('\\', '\\\\');
			let database = databaseName ? `, database="${databaseName}"` : '';
			const auth = connection.userName ? `, uid="${connection.userName}", pwd="${credentials[azdata.ConnectionOptionSpecialType.password]}"` : '';
			let connectionParts = `server="${server}"${auth}${database}`;
			let rCommandScript = scriptMode === ScriptMode.Install ? 'sql_install.packages' : 'sql_remove.packages';

			let scripts: string[] = [
				'formals(quit)$save <- formals(q)$save <- "no"',
				'library(sqlmlutils)',
				`connection <- connectionInfo(driver= "ODBC Driver 17 for SQL Server", ${connectionParts})`,
				`r = getOption("repos")`,
				`r["CRAN"] = "${this._config.rPackagesRepository}"`,
				`options(repos = r)`,
				`pkgs <- c("${packageDetails.name}")`,
				`${rCommandScript}(connectionString = connection, pkgs, scope = "PUBLIC")`,
				'q()'
			];
			let rExecutable = await this._config.getRExecutable(true);
			await this._processService.execScripts(`${rExecutable}`, scripts, ['--vanilla'], this._outputChannel);
		}
	}

	/**
	 * Returns true if the provider can be used
	 */
	async canUseProvider(): Promise<boolean> {
		if (!this._config.rEnabled) {
			return false;
		}
		let connection = await this.getCurrentConnection();
		if (connection && await this._service.isRInstalled(connection)) {
			return true;
		}
		return false;
	}

	private getPackageLink(packageName: string): string {
		return `${this._config.rPackagesRepository}/web/packages/${packageName}`;
	}

	/**
	 * Returns package overview for given name
	 * @param packageName Package Name
	 */
	protected async fetchPackage(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
		let packagePreview: nbExtensionApis.IPackageOverview = {
			name: packageName,
			versions: [constants.latestVersion],
			summary: ''
		};

		await this._httpClient.fetch(this.getPackageLink(packageName));
		return packagePreview;
	}
}
