/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { InitialVariableValues, NotebookBasedDialogInfo } from './interfaces';
import { NotebookService } from './services/notebookService';
import { PlatformService } from './services/platformService';
import { OptionValuesFilter, ResourceTypeService } from './services/resourceTypeService';
import { ToolsService } from './services/toolsService';
import { DeploymentInputDialog } from './ui/deploymentInputDialog';
import { ResourceTypePickerDialog } from './ui/resourceTypePickerDialog';
import * as rd from 'resource-deployment';
import { getExtensionApi } from './api';
import { UriHandlerService } from './services/uriHandlerService';

const localize = nls.loadMessageBundle();

export async function activate(context: vscode.ExtensionContext): Promise<rd.IExtension> {
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
		return <any>undefined;
	}
	const uriHandlerService = new UriHandlerService(resourceTypeService);
	vscode.window.registerUriHandler(uriHandlerService);
	/**
	 * Opens a new ResourceTypePickerDialog
	 * @param defaultResourceTypeName The resource type name to have selected by default
	 * @param resourceTypeNameFilters Optional filters to apply to the resource types displayed. If undefined all
	 * resource types will be displayed
	 */
	const openDialog = (defaultResourceTypeName: string, resourceTypeNameFilters?: string[], optionValuesFilter?: OptionValuesFilter, initialVariableValues?: InitialVariableValues) => {
		const defaultResourceType = resourceTypes.find(resourceType => resourceType.name === defaultResourceTypeName);
		if (!defaultResourceType) {
			vscode.window.showErrorMessage(localize('resourceDeployment.UnknownResourceType', "The resource type: {0} is not defined", defaultResourceTypeName));
		} else {
			const dialog = new ResourceTypePickerDialog(resourceTypeService, defaultResourceType, resourceTypeNameFilters, optionValuesFilter, initialVariableValues);
			dialog.open();
		}
	};

	vscode.commands.registerCommand('azdata.resource.sql-image.deploy', () => {
		openDialog('sql-image');
	});
	vscode.commands.registerCommand('azdata.resource.sql-bdc.deploy', () => {
		openDialog('sql-bdc');
	});
	/**
	 * Command to open the Resource Deployment wizard - with options to filter the values shown
	 * @param defaultResourceTypeName - The default resourceType to be selected
	 * @param resourceTypeNameFilters - The list of resourceTypes to show in the wizard
	 * @param optionValuesFilter - The list of resourceType option values to show in the wizard. This is an object in the format
	 * { "resource-type-name": { "option-name": ["option-value-1", "option-value-2"] } }
	 * @param initialVariableValues - Optional list of initial values to assign to variables. This is an object of key/value pairs in the format
	 * { "VARIABLE_NAME": "value", "OTHER_VARIABLE_NAME": "value" }
	 */
	vscode.commands.registerCommand('azdata.resource.deploy', (defaultResourceTypeName?: string, resourceTypeNameFilters?: string[], optionValuesFilter?: OptionValuesFilter, initialVariableValues?: InitialVariableValues) => {
		if ((resourceTypeNameFilters && !Array.isArray(resourceTypeNameFilters) ||
			(resourceTypeNameFilters && resourceTypeNameFilters.length > 0 && typeof resourceTypeNameFilters[0] !== 'string'))) {
			throw new Error('resourceTypeNameFilters must either be undefined or an array of strings');
		}

		if (typeof defaultResourceTypeName === 'string') {
			openDialog(defaultResourceTypeName, resourceTypeNameFilters, optionValuesFilter, initialVariableValues);
		} else {
			let defaultDeploymentType: string;
			if (platformService.platform() === 'win32') {
				defaultDeploymentType = 'sql-windows-setup';
			} else {
				defaultDeploymentType = 'sql-image';
			}
			openDialog(defaultDeploymentType, resourceTypeNameFilters, optionValuesFilter, initialVariableValues);
		}
	});
	vscode.commands.registerCommand('azdata.openNotebookInputDialog', (dialogInfo: NotebookBasedDialogInfo) => {
		const dialog = new DeploymentInputDialog(notebookService, platformService, toolsService, dialogInfo);
		dialog.open();
	});
	return getExtensionApi();
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}
