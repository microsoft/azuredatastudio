/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, IActionContext } from '@microsoft/vscode-azext-utils';
import { IConnectionInfo } from 'vscode-mssql';
import * as azureFunctionsUtils from '../common/azureFunctionsUtils';

/**
 * This execute step is used to add a connection string to the local.settings.json file when creating a new Azure Functions project
 * and is needed due to vscode restarting the extension host after the user chooses to open project in new window or current window
 * through the createFunction API call for vscode-azurefunctions
 * @param projectFolder The folder containing the Azure Functions project
 * @param connectionInfo The connection info to use when creating the connection string
 * @param connectionStringSettingName the name of the connection string setting
 * @returns AzureWizardExecuteStep to be used in the createFunction API call
 */
export function createAddConnectionStringStep(projectFolder: string, connectionInfo: IConnectionInfo, connectionStringSettingName?: string): AzureWizardExecuteStep<IActionContext> {
	return new class AzureWizardExecuteStep {
		// priority number is set to be lower than OpenFolderStep in vscode-azurefunctions
		// https://github.com/microsoft/vscode-azurefunctions/blob/main/src/commands/createNewProject/OpenFolderStep.ts#L11
		public priority: number = 240;

		public async execute(): Promise<void> {
			let settingsFile = await azureFunctionsUtils.getSettingsFile(projectFolder);
			if (!settingsFile) {
				return;
			}
			let connectionString = await azureFunctionsUtils.promptConnectionStringPasswordAndUpdateConnectionString(connectionInfo, settingsFile);
			if (!connectionString) {
				return;
			}
			void azureFunctionsUtils.addConnectionStringToConfig(connectionString, projectFolder, connectionStringSettingName);
		}

		public shouldExecute(): boolean {
			return true;
		}
	};
}
