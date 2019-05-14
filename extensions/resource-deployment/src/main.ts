/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');
import { ResourceDeploymentDialog } from './ui/resourceDeploymentDialog';
import { ResourceTypeParser } from './resourceTypeParser';
import { ResourceTypeValidator } from './resourceTypeValidator';

export function activate(context: vscode.ExtensionContext) {
	const resourceTypes = ResourceTypeParser.getResourceTypes();
	const errorMessages = ResourceTypeValidator.validate(resourceTypes);
	if (errorMessages.length !== 0) {
		console.error('Error detected in the supported resource type configuration.');
		errorMessages.forEach(message => console.error(message));
		return;
	}

	vscode.commands.registerCommand('azdata.resource.sql-image.deploy', () => {
		let dialog = new ResourceDeploymentDialog();
		dialog.open();
	});
	vscode.commands.registerCommand('azdata.resource.sql-bdc.deploy', () => {
		let dialog = new ResourceDeploymentDialog();
		dialog.open();
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}