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
	/**
	 * Opens a new ResourceTypePickerDialog
	 * @param defaultResourceTypeName The resource type name to have selected by default
	 * @param resourceTypeNameFilters Optional filters to apply to the resource types displayed. If undefined all
	 * resource types will be displayed
	 */
	const openDialog = (defaultResourceTypeName: string, resourceTypeNameFilters?: string[]) => {
		const defaultResourceType = resourceTypes.find(resourceType => resourceType.name === defaultResourceTypeName);
		if (!defaultResourceType) {
			vscode.window.showErrorMessage(localize('resourceDeployment.UnknownResourceType', "The resource type: {0} is not defined", defaultResourceTypeName));
		} else {
			const dialog = new ResourceTypePickerDialog(toolsService, resourceTypeService, defaultResourceType, resourceTypeNameFilters);
			dialog.open();
		}
	};

	vscode.commands.registerCommand('azdata.resource.sql-image.deploy', () => {
		openDialog('sql-image');
	});
	vscode.commands.registerCommand('azdata.resource.sql-bdc.deploy', () => {
		openDialog('sql-bdc');
	});
	vscode.commands.registerCommand('azdata.resource.deploy', (defaultResourceTypeName?: string, resourceTypeNameFilters?: string[]) => {
		if ((resourceTypeNameFilters && !Array.isArray(resourceTypeNameFilters) ||
			(resourceTypeNameFilters && resourceTypeNameFilters.length > 0 && typeof resourceTypeNameFilters[0] !== 'string'))) {
			throw new Error('resourceTypeNameFilters must either be undefined or an array of strings');
		}

		if (typeof defaultResourceTypeName === 'string') {
			openDialog(defaultResourceTypeName, resourceTypeNameFilters);
		} else {
			let defaultDeploymentType: string;
			if (platformService.platform() === 'win32') {
				defaultDeploymentType = 'sql-windows-setup';
			} else {
				defaultDeploymentType = 'sql-image';
			}
			openDialog(defaultDeploymentType, resourceTypeNameFilters);
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
