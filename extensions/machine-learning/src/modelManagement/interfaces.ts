/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';
import { Resource } from '@azure/arm-machinelearningservices/esm/models';
import { DatabaseTable } from '../prediction/interfaces';

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
	description?: string;
	frameworkVersion?: string;
	createdBy?: string;
	createdTime?: string;
	experimentName?: string;
	outputsSchema?: Array<string>;
	url?: string;
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
 * An interface representing imported model
 */
export interface ImportedModel extends ImportedModelDetails {
	id: number;
	content?: string;
	contentLength?: number;
	table: DatabaseTable;
}

export interface ModelParameter {
	name: string;
	type: string;
	originalType?: string;
}

export interface ModelParameters {
	inputs: ModelParameter[],
	outputs: ModelParameter[]
}

/**
 * An interface representing imported model
 */
export interface ImportedModelDetails {
	modelName: string;
	created?: string;
	deploymentTime?: string;
	version?: string;
	description?: string;
	fileName?: string;
	framework?: string;
	frameworkVersion?: string;
	runId?: string;
	deployedBy?: string;
}

/**
 * The Artifact definition.
 */
export interface ArtifactDetails {
	/**
	 * The Artifact Id.
	 */
	id?: string;
	/**
	 * The Artifact prefix.
	 */
	prefix?: string;
}

/**
 * @interface
 * An interface representing Asset.
 * The Asset definition.
 *
 */
export interface Asset {
	/**
	 * @member {string} [id] The Asset Id.
	 */
	id?: string;
	/**
	 * @member {string} [name] The name of the Asset.
	 */
	name?: string;
	/**
	 * @member {string} [description] The Asset description.
	 */
	description?: string;
	/**
	 * @member {ArtifactDetails[]} [artifacts] A list of child artifacts.
	 */
	artifacts?: ArtifactDetails[];
	/**
	 * @member {string[]} [tags] The Asset tag list.
	 */
	tags?: string[];
	/**
	 * @member {{ [propertyName: string]: string }} [kvTags] The Asset tag
	 * dictionary. Tags are mutable.
	 */
	kvTags?: { [propertyName: string]: string };
	/**
	 * @member {{ [propertyName: string]: string }} [properties] The Asset
	 * property dictionary. Properties are immutable.
	 */
	properties?: { [propertyName: string]: string };
	/**
	 * @member {string} [runid] The RunId associated with this Asset.
	 */
	runid?: string;
	/**
	 * @member {string} [projectid] The project Id.
	 */
	projectid?: string;
	/**
	 * @member {{ [propertyName: string]: string }} [meta] A dictionary
	 * containing metadata about the Asset.
	 */
	meta?: { [propertyName: string]: string };
	/**
	 * @member {Date} [createdTime] The time the Asset was created in UTC.
	 */
	createdTime?: Date;
}


/**
 * Contains response data for the queryById operation.
 */
export type AssetsQueryByIdResponse = Asset & {
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
		parsedBody: Asset;
	};
};

export interface IArtifactParts {
	origin: string;
	container: string;
	path: string;
}

/**
* @interface
* An interface representing ArtifactContentInformationDto.
*/
export interface ArtifactContentInformationDto {
	/**
	 * @member {string} [contentUri]
	 */
	contentUri?: string;
	/**
	 * @member {string} [origin]
	 */
	origin?: string;
	/**
	 * @member {string} [container]
	 */
	container?: string;
	/**
	 * @member {string} [path]
	 */
	path?: string;
}
/**
 * Contains response data for the getArtifactContentInformation2 operation.
 */
export type GetArtifactContentInformation2Response = ArtifactContentInformationDto & {
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
		parsedBody: ArtifactContentInformationDto;
	};
};
/**
 * @interface
 * An interface representing ArtifactAPIGetArtifactContentInformation2OptionalParams.
 * Optional Parameters.
 *
 * @extends RequestOptionsBase
 */
export interface ArtifactAPIGetArtifactContentInformation2OptionalParams extends msRest.RequestOptionsBase {
	/**
	 * @member {string} [projectName]
	 */
	projectName?: string;
	/**
	 * @member {string} [path]
	 */
	path?: string;
	/**
	 * @member {string} [accountName]
	 */
	accountName?: string;
}

