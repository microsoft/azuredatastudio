/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { ApiWrapper } from './apiWrapper';

const listPythonPackagesQuery = `
EXEC sp_execute_external_script
@language=N'Python',
@script=N'import pkg_resources
import pandas
OutputDataSet = pandas.DataFrame([(d.project_name, d.version) for d in pkg_resources.working_set])'
`;

const checkMlInstalledQuery = `
Declare @tablevar table(name NVARCHAR(MAX), min INT, max INT, config_value bit, run_value bit)
insert into @tablevar(name, min, max, config_value, run_value) exec sp_configure

Declare @external_script_enabled bit
SELECT @external_script_enabled=config_value FROM @tablevar WHERE name = 'external scripts enabled'
SELECT @external_script_enabled`;

const checkPythonInstalledQuery = `

SELECT is_installed
FROM sys.dm_db_external_language_stats s, sys.external_languages l
WHERE s.external_language_id = l.external_language_id AND language = 'Python'`;

const modifyExternalScriptConfigQuery = `

EXEC sp_configure 'external scripts enabled', #CONFIG_VALUE#;
RECONFIGURE WITH OVERRIDE;

Declare @tablevar table(name NVARCHAR(MAX), min INT, max INT, config_value bit, run_value bit)
insert into @tablevar(name, min, max, config_value, run_value) exec sp_configure

Declare @external_script_enabled bit
SELECT @external_script_enabled=config_value FROM @tablevar WHERE name = 'external scripts enabled'
SELECT @external_script_enabled`;

/**
 * SQL Query runner
 */
export class QueryRunner {

	constructor(private _apiWrapper: ApiWrapper) {
	}

	/**
	 * Returns python packages installed in SQL server instance
	 * @param connection SQL Connection
	 */
	public async getPythonPackages(connection: azdata.connection.ConnectionProfile): Promise<nbExtensionApis.IPackageDetails[]> {
		let packages: nbExtensionApis.IPackageDetails[] = [];
		let result = await this.runQuery(connection, listPythonPackagesQuery);
		if (result && result.rows.length > 0) {
			packages = result.rows.map(row => {
				return {
					name: row[0].displayValue,
					version: row[1].displayValue
				};
			});
		}
		return packages;
	}

	/**
	 * Updates External Script Config in a SQL server instance
	 * @param connection SQL Connection
	 * @param enable if true the config will be enabled otherwise it will be disabled
	 */
	public async updateExternalScriptConfig(connection: azdata.connection.ConnectionProfile, enable: boolean): Promise<void> {
		let query = modifyExternalScriptConfigQuery;
		let configValue = enable ? '1' : '0';
		query = query.replace('#CONFIG_VALUE#', configValue);

		await this.runQuery(connection, query);
	}

	/**
	 * Returns true if python installed in the give SQL server instance
	 */
	public async isPythonInstalled(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		let result = await this.runQuery(connection, checkPythonInstalledQuery);
		let isInstalled = false;
		if (result && result.rows && result.rows.length > 0) {
			isInstalled = result.rows[0][0].displayValue === '1';
		}
		return isInstalled;
	}

	/**
	 * Returns true if mls is installed in the give SQL server instance
	 */
	public async isMachineLearningServiceEnabled(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		let result = await this.runQuery(connection, checkMlInstalledQuery);
		let isEnabled = false;
		if (result && result.rows && result.rows.length > 0) {
			isEnabled = result.rows[0][0].displayValue === '1';
		}
		return isEnabled;
	}

	private async runQuery(connection: azdata.connection.ConnectionProfile, query: string): Promise<azdata.SimpleExecuteResult | undefined> {
		let result: azdata.SimpleExecuteResult | undefined = undefined;
		try {
			if (connection) {
				let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
				let queryProvider = this._apiWrapper.getProvider<azdata.QueryProvider>(connection.providerId, azdata.DataProviderType.QueryProvider);
				if (queryProvider) {
					result = await queryProvider.runQueryAndReturn(connectionUri, query);
				}
			}
		} catch (error) {
			console.log(error);
		}
		return result;
	}
}
