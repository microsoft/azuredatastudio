/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ResourceTypeService } from './resourceTypeService';
import * as loc from '../localizedConstants';

interface IGalleryExtension {
	name: string;
	version: string;
	date: string;
	displayName: string;
	publisherId: string;
	publisher: string;
	publisherDisplayName: string;
	description: string;
	preview: boolean;
}

export class UriHandlerService implements vscode.UriHandler {
	constructor(private _resourceTypeService: ResourceTypeService) { }

	async handleUri(uri: vscode.Uri): Promise<void> {
		// Path to start a deployment
		// Supported URI parameters :
		//    - type (optional) : The resource type to start the deployment for
		//    - extension (optional) : The ID of the extension that is required to start the deployment
		//    - params (optional) : A JSON blob of variable names/values to pass as initial values to the wizard. Note
		//                          that the JSON blob must be URI-encoded in order to be properly handled
		// Example URIs :
		//   azuredatastudio://Microsoft.resource-deployment/deploy
		//   azuredatastudio://Microsoft.resource-deployment/deploy?type=arc-controller
		//   azuredatastudio://Microsoft.resource-deployment/deploy?type=arc-controller&extension=Microsoft.arc
		//   azuredatastudio://Microsoft.resource-deployment/deploy?type=arc-controller&params=%7B%22AZDATA_NB_VAR_ARC_SUBSCRIPTION%22%3A%22abdcef12-3456-7890-abcd-ef1234567890%22%2C%22AZDATA_NB_VAR_ARC_RESOURCE_GROUP%22%3A%22my-rg%22%2C%22AZDATA_NB_VAR_ARC_DATA_CONTROLLER_LOCATION%22%3A%22westus%22%2C%22AZDATA_NB_VAR_ARC_DATA_CONTROLLER_NAME%22%3A%22arc-dc%22%7D
		if (uri.path === '/deploy') {
			const params = uri.query.split('&').map(kv => kv.split('='));
			const paramType = params.find(param => param[0] === 'type')?.[1];
			const extensionId = params.find(param => param[0] === 'extension')?.[1];
			if (extensionId) {
				const installedExtension = vscode.extensions.getExtension(extensionId);
				if (!installedExtension) {
					// The required extension isn't installed, prompt user to install it
					const extensionGalleryInfo = await vscode.commands.executeCommand<IGalleryExtension>('workbench.extensions.getExtensionFromGallery', extensionId);
					if (extensionGalleryInfo) {
						const response = await vscode.window.showInformationMessage(
							loc.extensionRequiredPrompt(extensionGalleryInfo.displayName),
							loc.install);
						if (response === loc.install) {
							await vscode.window.withProgress(
								{
									location: vscode.ProgressLocation.Notification,
									title: loc.installingExtension(extensionGalleryInfo.displayName),
									cancellable: false
								}, async (_progress, _token) => {
									await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId);
								}
							);
						} else {
							// If user didn't install extension we wouldn't expect the deployment to work so just return
							console.log(`User cancelled out of prompt to install required extension '${extensionId}' for Resource Deployment URI`);
							return;
						}
					} else {
						// If we can't find the extension in the gallery then we won't be able to install it - so just inform the user
						// that the ID is invalid and return since we wouldn't expect the deployment to work without the extension
						vscode.window.showErrorMessage(loc.unknownExtension(extensionId));
						return;
					}
				} else {
					// Extension is already installed, ensure that it's activated before continuing on
					await installedExtension.activate();
				}
			}
			const wizardParams = JSON.parse(params.find(param => param[0] === 'params')?.[1] ?? '{}');

			const resourceType = this._resourceTypeService.getResourceTypes().find(type => type.name === paramType);
			if (paramType && !resourceType) {
				console.warn(`Unknown resource type ${paramType}`);
			}

			if (resourceType) {
				this._resourceTypeService.startDeployment(resourceType, undefined, wizardParams);
			} else {
				return vscode.commands.executeCommand('azdata.resource.deploy');
			}

		}
	}
}
