/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { NotebookBasedDialogInfo } from './interfaces';
import { NotebookService } from './services/notebookService';
import { PlatformService } from './services/platformService';
import { ResourceTypeService } from './services/resourceTypeService';
import { ToolsService } from './services/toolsService';
import { DeploymentInputDialog } from './ui/deploymentInputDialog';
import { ResourceTypePickerDialog } from './ui/resourceTypePickerDialog';

const localize = nls.loadMessageBundle();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const platformService = new PlatformService(context.globalStoragePath);
	await platformService.initialize();
	const toolsService = new ToolsService(platformService);
	const notebookService = new NotebookService(platformService, context.extensionPath);
	const resourceTypeService = new ResourceTypeService(platformService, toolsService, notebookService);
	const resourceTypes = resourceTypeService.getResourceTypes();
	const validationFailures = resourceTypeService.validateResourceTypes(resourceTypes);
	if (validationFailures.length !== 0) {
		const errorMessage = localize('resourceDeployment.FailedToLoadExtension', "Failed to load extension: {0}, Error detected in the resource type definition in package.json, check debug console for details.", context.extensionPath);
		vscode.window.showErrorMessage(errorMessage);
		validationFailures.forEach(message => console.error(message));
		return;
	}
	const openDialog = (resourceTypeName: string) => {
		const filtered = resourceTypes.filter(resourceType => resourceType.name === resourceTypeName);
		if (filtered.length !== 1) {
			vscode.window.showErrorMessage(localize('resourceDeployment.UnknownResourceType', "The resource type: {0} is not defined", resourceTypeName));
		} else {
			const dialog = new ResourceTypePickerDialog(toolsService, resourceTypeService, filtered[0]);
			dialog.open();
		}
	};

	vscode.commands.registerCommand('azdata.resource.sql-image.deploy', () => {
		openDialog('sql-image');
	});
	vscode.commands.registerCommand('azdata.resource.sql-bdc.deploy', () => {
		openDialog('sql-bdc');
	});
	vscode.commands.registerCommand('azdata.resource.deploy', (resourceType: string) => {
		if (typeof resourceType === 'string') {
			openDialog(resourceType);
		} else {
			openDialog('sql-image');
		}
	});
	vscode.commands.registerCommand('azdata.openNotebookInputDialog', (dialogInfo: NotebookBasedDialogInfo) => {
		const dialog = new DeploymentInputDialog(notebookService, platformService, dialogInfo);
		dialog.open();
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}
