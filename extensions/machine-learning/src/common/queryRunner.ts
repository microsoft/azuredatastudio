/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nbExtensionApis from '../typings/notebookServices';
import { ApiWrapper } from './apiWrapper';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

const maxNumberOfRetries = 2;

const listPythonPackagesQuery = `
Declare @tablevar table(name NVARCHAR(MAX), version NVARCHAR(MAX))
insert into @tablevar(name, version)
EXEC sp_execute_external_script
@language=N'Python',
@script=N'import pkg_resources
import pandas
OutputDataSet = pandas.DataFrame([(d.project_name, d.version) for d in pkg_resources.working_set])'
select t.name, (CASE   WHEN e.name is NULL THEN 1 ELSE 0 END) as isReadOnly , version from @tablevar t
left join sys.external_libraries e  on e.name = t.name and upper(e.[language]) = 'PYTHON'
`;

const listRPackagesQuery = `
Declare @tablevar table(name NVARCHAR(MAX), version NVARCHAR(MAX))
insert into @tablevar(name, version)
EXEC sp_execute_external_script
@language=N'R',
@script=N'
OutputDataSet <- as.data.frame(installed.packages()[,c(1,3)])'
select t.name, (CASE   WHEN e.name is NULL THEN 1 ELSE 0 END) as isReadOnly , version from @tablevar t
left join sys.external_libraries e  on e.name = t.name and upper(e.[language]) = 'R'
`;

const checkMlInstalledQuery = `
Declare @tablevar table(name NVARCHAR(MAX), min INT, max INT, config_value bit, run_value bit)
insert into @tablevar(name, min, max, config_value, run_value) exec sp_configure

Declare @external_script_enabled bit
SELECT @external_script_enabled=config_value FROM @tablevar WHERE name = 'external scripts enabled'
SELECT @external_script_enabled`;

const checkLanguageInstalledQuery = `

SELECT is_installed
FROM sys.dm_db_external_language_stats s, sys.external_languages l
WHERE s.external_language_id = l.external_language_id AND language = '#LANGUAGE#'`;

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
	public async getPythonPackages(connection: azdata.connection.ConnectionProfile, databaseName: string): Promise<nbExtensionApis.IPackageDetails[]> {
		return this.getPackages(connection, databaseName, listPythonPackagesQuery);
	}

	/**
	 * Returns python packages installed in SQL server instance
	 * @param connection SQL Connection
	 */
	public async getRPackages(connection: azdata.connection.ConnectionProfile, databaseName: string): Promise<nbExtensionApis.IPackageDetails[]> {
		return this.getPackages(connection, databaseName, listRPackagesQuery);
	}

	private async getPackages(connection: azdata.connection.ConnectionProfile, databaseName: string, script: string): Promise<nbExtensionApis.IPackageDetails[]> {
		let packages: nbExtensionApis.IPackageDetails[] = [];
		let result: azdata.SimpleExecuteResult | undefined = undefined;

		for (let index = 0; index < maxNumberOfRetries; index++) {
			result = await this.runQuery(connection, utils.getScriptWithDBChange(connection.databaseName, databaseName, script));
			if (result && result.rowCount > 0) {
				break;
			}
		}

		if (result && result.rows.length > 0) {
			packages = result.rows.map(row => {
				return {
					name: row[0].displayValue,
					readonly: row[1].displayValue === '1',
					version: row[2].displayValue
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
		return this.isLanguageInstalled(connection, constants.pythonLanguageName);
	}

	/**
	 * Returns true if R installed in the give SQL server instance
	 */
	public async isRInstalled(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		return this.isLanguageInstalled(connection, constants.rLanguageName);
	}

	/**
	 * Returns true if language installed in the give SQL server instance
	 */
	private async isLanguageInstalled(connection: azdata.connection.ConnectionProfile, language: string): Promise<boolean> {
		let result = await this.runQuery(connection, checkLanguageInstalledQuery.replace('#LANGUAGE#', language));
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

	public async runQuery(connection: azdata.connection.ConnectionProfile, query: string): Promise<azdata.SimpleExecuteResult | undefined> {
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

	/**
	 * Executes the query but doesn't fail it is fails
	 * @param connection SQL connection
	 * @param query query to run
	 */
	public async safeRunQuery(connection: azdata.connection.ConnectionProfile, query: string): Promise<azdata.SimpleExecuteResult | undefined> {
		try {
			return await this.runQuery(connection, query);
		} catch (error) {
			//console.log(error);
			return undefined;
		}
	}

	/**
	 * Executes the query but doesn't fail it is fails
	 * @param connection SQL connection
	 * @param query query to run
	 */
	public async runWithDatabaseChange(connection: azdata.connection.ConnectionProfile, query: string, queryDb: string): Promise<azdata.SimpleExecuteResult | undefined> {
		if (connection) {
			try {
				return await this.runQuery(connection, `
				USE [${utils.doubleEscapeSingleBrackets(queryDb)}]
				${query}`);
			} catch (error) {
				console.log(error);
			}
			finally {
				this.safeRunQuery(connection, `USE [${utils.doubleEscapeSingleBrackets(connection.databaseName || 'master')}]`);
			}
		}
		return undefined;
	}
}



