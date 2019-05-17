/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');
import { ResourceDeploymentDialog } from './ui/resourceDeploymentDialog';
import { ToolsService } from './services/toolsService';
import { NotebookService } from './services/notebookService';
import { ResourceTypeService, PackageJsonPath } from './services/resourceTypeService';

export function activate(context: vscode.ExtensionContext) {
	const toolsService = new ToolsService();
	const notebookService = new NotebookService();
	const resourceTypeService = new ResourceTypeService(toolsService);

	const resourceTypes = resourceTypeService.getResourceTypes(PackageJsonPath);
	const validationFailures = resourceTypeService.validateResourceTypes(resourceTypes);
	if (validationFailures.length !== 0) {
		const errorMessage = `Failed to load extension: ${context.extensionPath}, Error detected in the resource type definition in package.json, check debug console for details.`;
		vscode.window.showErrorMessage(errorMessage);
		validationFailures.forEach(message => console.error(message));
		return;
	}

	const openDialog = (resourceTypeName: string) => {
		const filtered = resourceTypes.filter(resourceType => resourceType.name === resourceTypeName);
		if (filtered.length !== 1) {
			vscode.window.showErrorMessage(`The resource type: ${resourceTypeName} is not defined`);
		}
		else {
			let dialog = new ResourceDeploymentDialog(context, notebookService, toolsService, resourceTypeService, filtered[0]);
			dialog.open();
		}
	};

	vscode.commands.registerCommand('azdata.resource.sql-image.deploy', () => {
		openDialog('sql-image');
	});
	vscode.commands.registerCommand('azdata.resource.sql-bdc.deploy', () => {
		openDialog('sql-bdc');
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}