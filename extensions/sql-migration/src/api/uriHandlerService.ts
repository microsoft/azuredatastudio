/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { connection, IConnectionProfile } from 'azdata';

export class UriHandlerService implements vscode.UriHandler {
	private _params: string[][] = [];

	constructor() { }

	async handleUri(uri: vscode.Uri): Promise<void> {
		// Path to start a new migration wizard
		//
		// Supported URI parameters:
		//     - databases (optional): A comma-separated list of source database names that will be automatically selected for assessment/migration when the wizard launches
		//	   - connection (optional): Either '__new' to denote that a new connection needs to be established, or (TO-DO) an existing connection URI
		//         - server (required): Server name to connect to
		//         - auth (required): Authentication type, either 'Integrated' or 'SqlLogin' for Windows and SQL auth respectively
		//         - username (required if using SqlLogin auth): SQL credential username
		// 	       - password (required if using SqlLogin auth): SQL credential password
		//
		// Example URIs:
		//     - azuredatastudio://Microsoft.sql-migration/start
		//         - Launches the migration wizard, as if the user were to manually click the 'Migrate to Azure SQL' button in the extension UI
		//     - azuredatastudio://Microsoft.sql-migration/start?databases=AdventureWorks,AdventureWorks2
		//         - Launches the migration wizard, skipping the page which asks the user whether or not they want to start a new session, and goes directly to step 1 of the
		//           wizard with the databases AdventureWorks and AdventureWorks2 automatically selected.
		//     - azuredatastudio://Microsoft.sql-migration/start?databases=__all
		//         - Launches the migration wizard, skipping directly to step 1 of the wizard, with all databases automatically selected.
		//     - azuredatastudio://Microsoft.sql-migration/start?connection=__new&server=ServerName&auth=Integrated
		//         - Launches the migration wizard, automatically establishing a new connection to server ServerName with Windows auth

		if (uri.path === '/start') {
			this._params = uri.query.split('&').map(kv => kv.split('='));
			const databasesParam = this.getQueryParameterValue('databases');

			//
			const connectionParam = this.getQueryParameterValue('connection');
			if (connectionParam === '__new') {
				const serverNameParam = this.getQueryParameterValue('server')!;
				const authenticationTypeParam = this.getQueryParameterValue('auth')!;		// Integrated, SqlLogin
				const usernameParam = this.getQueryParameterValue('username')!;
				const passwordParam = this.getQueryParameterValue('password')!;

				const connectionProfile: IConnectionProfile = {
					'connectionName': 'UriTest',
					'serverName': serverNameParam,
					'databaseName': 'master',
					'userName': usernameParam,
					'password': passwordParam,
					'authenticationType': authenticationTypeParam,
					'savePassword': false,
					'groupFullName': '',
					'groupId': 'C777F06B-202E-4480-B475-FA416154D458',
					'providerName': 'MSSQL',
					'saveProfile': false,
					'id': '',
					'azureTenantId': '',
					'options': {}
				};

				const conn = await connection.connect(connectionProfile, true, false);
				console.log(conn.connectionId);

				void vscode.commands.executeCommand('sqlmigration.start', databasesParam, conn.connectionId);
			} else {
				void vscode.commands.executeCommand('sqlmigration.start', databasesParam);
			}
		}

		if (uri.path === '/test') {
			// const x = await connection.openConnectionDialog();
			// console.log(x.connectionId);
			// const activeConnections = await azdata.connection.getActiveConnections();
			// console.log(activeConnections);
			// const currentConnection = await connection.getCurrentConnection();
			// console.log(currentConnection);
		}
	}

	private getQueryParameterValue(parameterName: string): string | undefined {
		return this._params.find(param => param[0].toLowerCase() === parameterName.toLowerCase())?.[1];
	}
}
