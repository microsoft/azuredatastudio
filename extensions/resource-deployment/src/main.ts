/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
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
		const editor = azdata.workspace.createModelViewEditor('Test', { retainContextWhenHidden: true, supportsSave: true, resourceName: '' });
		editor.registerContent(view => {
			const text = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'abc' }).component();
			const text2 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'abc2' }).component();
			const text3 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'abc3' }).component();
			const text4 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'abc4' }).component();
			const text5 = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'abc5' }).component();
			const tab1 = view.modelBuilder.flexContainer().withItems([text, text5]).component();

			const dashboard = view.modelBuilder.tabbedPanel().withTabs([{
				content: tab1,
				title: 'Tab2',
				id: 'tab2'
			},
			{
				title: 'Group1',
				tabs: [{
					content: text3,
					title: 'Tab3',
					id: 'tab3'
				}]
			}, {
				title: 'Group2',
				tabs: [{
					content: text4,
					title: 'Tab4',
					id: 'tab4'
				}]
			}, {
				content: text2,
				title: 'Tab1',
				id: 'tab1'
			}]).component();
			dashboard.onTabChanged((tabId: string) => {
				vscode.window.showInformationMessage(tabId);
			});
			return view.initializeModel(dashboard);
		});
		editor.openEditor();
	});
	vscode.commands.registerCommand('azdata.openNotebookInputDialog', (dialogInfo: NotebookBasedDialogInfo) => {
		const dialog = new DeploymentInputDialog(notebookService, platformService, dialogInfo);
		dialog.open();
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}
