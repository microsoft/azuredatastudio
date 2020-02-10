/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';
import { AzureMachineLearningWorkspacesContext } from '@azure/arm-machinelearningservices';
import * as Models from './interfaces';
import * as Mappers from './mappers';
import * as Parameters from './parameters';


export class WorkspaceModels {
	private readonly client: AzureMachineLearningWorkspacesContext;

	constructor(client: AzureMachineLearningWorkspacesContext) {
		this.client = client;
	}


	listKeys(resourceGroupName: string, workspaceName: string, options?: msRest.RequestOptionsBase): Promise<Models.ListWorkspaceModelsResult>;
	listKeys(resourceGroupName: string, workspaceName: string, callback: msRest.ServiceCallback<Models.ListWorkspaceModelsResult>): void;
	listKeys(resourceGroupName: string, workspaceName: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.ListWorkspaceModelsResult>): void;
	listKeys(resourceGroupName: string, workspaceName: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.ListWorkspaceModelsResult>, callback?: msRest.ServiceCallback<Models.ListWorkspaceModelsResult>): Promise<Models.WorkspacesModelsResponse> {
		return this.client.sendOperationRequest(
			{
				resourceGroupName,
				workspaceName,
				options
			},
			listKeysOperationSpec,
			callback) as Promise<Models.WorkspacesModelsResponse>;
	}

}

const serializer = new msRest.Serializer(Mappers);
const listKeysOperationSpec: msRest.OperationSpec = {
	httpMethod: 'GET',
	path: 'subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.MachineLearningServices/workspaces/{workspaceName}/models',
	urlParameters: [
		Parameters.subscriptionId,
		Parameters.resourceGroupName,
		Parameters.workspaceName
	],
	queryParameters: [
		Parameters.apiVersion
	],
	headerParameters: [
		Parameters.acceptLanguage
	],
	responses: {
		200: {
			bodyMapper: Mappers.ListWorkspaceModelsResult
		},
		default: {
			bodyMapper: Mappers.MachineLearningServiceError
		}
	},
	serializer
};


