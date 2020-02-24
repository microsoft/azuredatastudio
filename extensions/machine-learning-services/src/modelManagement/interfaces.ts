/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';
import { Resource } from '@azure/arm-machinelearningservices/esm/models';

/**
 * An interface representing ListWorkspaceModelResult.
 */
export interface ListWorkspaceModelsResult extends Array<WorkspaceModel> {
}

/**
 * An interface representing Workspace model
 */
export interface WorkspaceModel extends Resource {
	framework?: string;
	frameworkVersion?: string;
	createdBy?: string;
	createdTime?: string;
	experimentName?: string;
	outputsSchema?: Array<string>;
}

/**
 * An interface representing Workspace model list response
 */
export type WorkspacesModelsResponse = ListWorkspaceModelsResult & {
	/**
	 * The underlying HTTP response.
	 */
	_response: msRest.HttpResponse & {
		/**
		 * The response body as text (string format)
		 */
		bodyAsText: string;

		/**
		 * The response body as parsed JSON or XML
		 */
		parsedBody: ListWorkspaceModelsResult;
	};
};

/**
 * An interface representing registered model
 */
export interface RegisteredModel {
	id: number,
	name: string
}
