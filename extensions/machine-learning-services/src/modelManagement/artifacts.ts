/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';
import * as Models from './interfaces';
import * as Mappers from './mappers';
import * as Parameters from './parameters';
import { AzureMachineLearningWorkspacesContext } from '@azure/arm-machinelearningservices';

export class Artifacts {
	private readonly client: AzureMachineLearningWorkspacesContext;

	constructor(client: AzureMachineLearningWorkspacesContext) {
		this.client = client;
	}

	getArtifactContentInformation2(subscriptionId: string, resourceGroupName: string, workspaceName: string, origin: string, container: string, options?: Models.ArtifactAPIGetArtifactContentInformation2OptionalParams): Promise<Models.GetArtifactContentInformation2Response>;
	getArtifactContentInformation2(subscriptionId: string, resourceGroupName: string, workspaceName: string, origin: string, container: string, callback: msRest.ServiceCallback<Models.ArtifactContentInformationDto>): void;
	getArtifactContentInformation2(subscriptionId: string, resourceGroupName: string, workspaceName: string, origin: string, container: string, options: Models.ArtifactAPIGetArtifactContentInformation2OptionalParams, callback: msRest.ServiceCallback<Models.ArtifactContentInformationDto>): void;
	getArtifactContentInformation2(subscriptionId: string, resourceGroupName: string, workspaceName: string, origin: string, container: string, options?: Models.ArtifactAPIGetArtifactContentInformation2OptionalParams | msRest.ServiceCallback<Models.ArtifactContentInformationDto>, callback?: msRest.ServiceCallback<Models.ArtifactContentInformationDto>): Promise<Models.GetArtifactContentInformation2Response> {
		return this.client.sendOperationRequest(
			{
				subscriptionId,
				resourceGroupName,
				workspaceName,
				origin,
				container,
				options
			},
			getArtifactContentInformation2OperationSpec,
			callback) as Promise<Models.GetArtifactContentInformation2Response>;
	}

}

const serializer = new msRest.Serializer(Mappers);
const getArtifactContentInformation2OperationSpec: msRest.OperationSpec = {
	httpMethod: 'GET',
	path: 'artifact/v1.0/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.MachineLearningServices/workspaces/{workspaceName}/artifacts/contentinfo/{origin}/{container}',
	urlParameters: [
		Parameters.subscriptionId,
		Parameters.resourceGroupName,
		Parameters.workspaceName,
		Parameters.origin,
		Parameters.container,
		Parameters.apiVersion
	],
	queryParameters: [
		Parameters.projectName0,
		Parameters.path1,
		Parameters.accountName
	],
	responses: {
		200: {
			bodyMapper: Mappers.ArtifactContentInformationDto
		},
		default: {}
	},
	serializer
};
