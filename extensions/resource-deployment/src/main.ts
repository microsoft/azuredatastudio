/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');
import { ResourceDeploymentDialog } from './ui/resourceDeploymentDialog';
import { ToolsService } from './services/toolsService';
import { NotebookService } from './services/notebookService';
import { ResourceTypeService } from './services/resourceTypeService';
import { PlatformService } from './services/platformService';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export function activate(context: vscode.ExtensionContext) {
	const platformService = new PlatformService();
	const toolsService = new ToolsService();
	const notebookService = new NotebookService(platformService, context.extensionPath);
	const resourceTypeService = new ResourceTypeService(platformService, toolsService);

	const resourceTypes = resourceTypeService.getResourceTypes();
	const validationFailures = resourceTypeService.validateResourceTypes(resourceTypes);
	if (validationFailures.length !== 0) {
		const errorMessage = localize('resourceDeployment.FailedToLoadExtension', 'Failed to load extension: {0}, Error detected in the resource type definition in package.json, check debug console for details.', context.extensionPath);
		vscode.window.showErrorMessage(errorMessage);
		validationFailures.forEach(message => console.error(message));
		return;
	}
	const openDialog = (resourceTypeName: string) => {
		const filtered = resourceTypes.filter(resourceType => resourceType.name === resourceTypeName);
		if (filtered.length !== 1) {
			vscode.window.showErrorMessage(localize('resourceDeployment.UnknownResourceType', 'The resource type: {0} is not defined', resourceTypeName));
		} else {
			const dialog = new ResourceDeploymentDialog(context, notebookService, toolsService, resourceTypeService, filtered[0]);
			dialog.open();
		}
	};

	vscode.commands.registerCommand('azdata.resource.sql-image.deploy', () => {
		openDialog('sql-image');
	});
	vscode.commands.registerCommand('azdata.resource.sql-bdc.deploy', () => {
		openDialog('sql-bdc');
	});
	vscode.commands.registerCommand('azdata.resource.deploy', () => {
		openDialog('sql-bdc');
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}