/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AppContext } from '../appContext';
import { openBackupDialog } from './backupDialog';

const backupCommand = 'mssql.backup';

export function registerBackupRestoreCommands(appContext: AppContext): void {
	appContext.extensionContext.subscriptions.push(vscode.commands.registerCommand(backupCommand, async () => {
		return openBackupDialog();
	}));
}
