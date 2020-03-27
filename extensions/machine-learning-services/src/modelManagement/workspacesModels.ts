/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';
import { AzureMachineLearningWorkspacesContext } from '@azure/arm-machinelearningservices';
import * as Models from './interfaces';
import * as Mappers from './mappers';
import * as Parameters from './parameters';

/**
 * Workspace models client
 */
export class WorkspaceModels {
	private readonly client: AzureMachineLearningWorkspacesContext;

	constructor(client: AzureMachineLearningWorkspacesContext) {
		this.client = client;
	}

	listModels(resourceGroupName: string, workspaceName: string, options?: msRest.RequestOptionsBase): Promise<Models.ListWorkspaceModelsResult>;
	listModels(resourceGroupName: string, workspaceName: string, callback: msRest.ServiceCallback<Models.ListWorkspaceModelsResult>): void;
	listModels(resourceGroupName: string, workspaceName: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.ListWorkspaceModelsResult>): void;
	listModels(resourceGroupName: string, workspaceName: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.ListWorkspaceModelsResult>, callback?: msRest.ServiceCallback<Models.ListWorkspaceModelsResult>): Promise<Models.WorkspacesModelsResponse> {
		return this.client.sendOperationRequest(
			{
				resourceGroupName,
				workspaceName,
				options
			},
			listModelsOperationSpec,
			callback) as Promise<Models.WorkspacesModelsResponse>;
	}
}

const serializer = new msRest.Serializer(Mappers);
const listModelsOperationSpec: msRest.OperationSpec = {
	httpMethod: 'GET',
	path:
		'modelmanagement/v1.0/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.MachineLearningServices/workspaces/{workspaceName}/models',
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


