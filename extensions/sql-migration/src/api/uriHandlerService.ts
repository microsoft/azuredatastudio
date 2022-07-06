/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class UriHandlerService implements vscode.UriHandler {
	constructor() { }

	async handleUri(uri: vscode.Uri): Promise<void> {
		// Path to start a new migration wizard
		//
		// Supported URI parameters:
		//     - databases (optional): A comma-separated list of source database names that will be automatically selected for assessment/migration when the wizard launches
		//
		// Example URIs:
		//     - azuredatastudio://Microsoft.sql-migration/start
		//         - Launches the migration wizard, as if the user were to manually click the "Migrate to Azure SQL" button in the extension UI
		//     - azuredatastudio://Microsoft.sql-migration/start?databases=AdventureWorks,AdventureWorks2
		//         - Launches the migration wizard, skipping the page which asks the user whether or not they want to start a new session, and goes directly to step 1 of the
		//           wizard with the databases AdventureWorks and AdventureWorks2 automatically selected.
		//     - azuredatastudio://Microsoft.sql-migration/start?databases=__all
		//         - Launches the migration wizard, skipping directly to step 1 of the wizard, with all databases automatically selected.
		if (uri.path === '/start') {
			const params = uri.query.split('&').map(kv => kv.split('='));
			const databases = params.find(param => param[0] === 'databases')?.[1];

			void vscode.commands.executeCommand('sqlmigration.start', databases);
		}
	}
}
