'use strict';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

export class MlServiceprovider {
	constructor() {
	}

	public async IsMachineLearningServiceEnabled(): Promise<boolean> {
		try {
			let connection = await azdata.connection.getCurrentConnection();
			let connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
			let query = `

			Declare @tablevar table(name NVARCHAR(MAX), min INT, max INT, config_value bit, run_value bit)
			insert into @tablevar(name, min, max, config_value, run_value) exec sp_configure

			Declare @external_script_enabled bit
			SELECT @external_script_enabled=config_value FROM @tablevar WHERE name = 'external scripts enabled'
			SELECT @external_script_enabled`;

			let currentConnection = await azdata.connection.getCurrentConnection();
			let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(currentConnection.providerId, azdata.DataProviderType.QueryProvider);

			let result = await queryProvider.runQueryAndReturn(connectionUri, query);
			vscode.window.setStatusBarMessage(result.rows[0][0].displayValue);
			return result.rows[0][0].displayValue === '1';
		} catch (error) {
			vscode.window.setStatusBarMessage(error);
			return false;
		}
	}

	public async IsPythonInstalled(): Promise<boolean> {
		try {
			let connection = await azdata.connection.getCurrentConnection();
			let connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
			let query = `

			SELECT is_installed
			FROM sys.dm_db_external_language_stats s, sys.external_languages l
			WHERE s.external_language_id = l.external_language_id AND language = 'Python'`;

			let currentConnection = await azdata.connection.getCurrentConnection();
			let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(currentConnection.providerId, azdata.DataProviderType.QueryProvider);

			let result = await queryProvider.runQueryAndReturn(connectionUri, query);
			vscode.window.setStatusBarMessage(result.rows[0][0].displayValue);
			return result.rows[0][0].displayValue === '1';
		} catch (error) {
			vscode.window.setStatusBarMessage(error);
			return false;
		}

	}

	public async ChangeExternalScriptConfig(enable: boolean): Promise<void> {
		try {
			let connection = await azdata.connection.getCurrentConnection();
			let connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
			let configValue = enable ? '1': '0';
			let query = `

			EXEC sp_configure 'external scripts enabled', ${configValue};
    		RECONFIGURE WITH OVERRIDE;

			Declare @tablevar table(name NVARCHAR(MAX), min INT, max INT, config_value bit, run_value bit)
			insert into @tablevar(name, min, max, config_value, run_value) exec sp_configure

			Declare @external_script_enabled bit
			SELECT @external_script_enabled=config_value FROM @tablevar WHERE name = 'external scripts enabled'
			SELECT @external_script_enabled`;

			let currentConnection = await azdata.connection.getCurrentConnection();
			let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(currentConnection.providerId, azdata.DataProviderType.QueryProvider);

			let result = await queryProvider.runQueryAndReturn(connectionUri, query);
		} catch (error) {
			vscode.window.setStatusBarMessage(error);
		}
	}

}
