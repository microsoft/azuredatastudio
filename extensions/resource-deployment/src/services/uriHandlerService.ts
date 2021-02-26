/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ResourceTypeService } from './resourceTypeService';

export class UriHandlerService implements vscode.UriHandler {
	constructor(private _resourceTypeService: ResourceTypeService) { }

	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		// Path to start a deployment
		// Supported URI parameters :
		//    - type (optional) : The resource type to start the deployment for
		//    - params (optional) : A JSON blob of variable names/values to pass as initial values to the wizard. Note
		//                          that the JSON blob must be URI-encoded in order to be properly handled
		// Example URIs :
		//   azuredatastudio://Microsoft.resource-deployment/deploy
		//   azuredatastudio://Microsoft.resource-deployment/deploy?type=arc-controller
		//   azuredatastudio://Microsoft.resource-deployment/deploy?type=arc-controller&params=%7B%22AZDATA_NB_VAR_ARC_SUBSCRIPTION%22%3A%22abdcef12-3456-7890-abcd-ef1234567890%22%2C%22AZDATA_NB_VAR_ARC_RESOURCE_GROUP%22%3A%22my-rg%22%2C%22AZDATA_NB_VAR_ARC_DATA_CONTROLLER_LOCATION%22%3A%22westus%22%2C%22AZDATA_NB_VAR_ARC_DATA_CONTROLLER_NAME%22%3A%22arc-dc%22%7D
		if (uri.path === '/deploy') {
			const params = uri.query.split('&').map(kv => kv.split('='));
			const paramType = params.find(param => param[0] === 'type')?.[1];
			const wizardParams = JSON.parse(params.find(param => param[0] === 'params')?.[1] ?? '{}');

			const resourceType = this._resourceTypeService.getResourceTypes().find(type => type.name === paramType);
			if (resourceType) {
				this._resourceTypeService.startDeployment(resourceType, undefined, wizardParams);
			} else {
				return vscode.commands.executeCommand('azdata.resource.deploy');
			}

		}
	}
}
