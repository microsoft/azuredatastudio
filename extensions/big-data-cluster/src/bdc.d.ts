/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'bdc' {

	export const enum constants {
		extensionName = 'Microsoft.big-data-cluster'
	}

	export interface IExtension {
		getClusterController(url: string, authType: AuthType, username?: string, password?: string): IClusterController;
	}

	export interface IEndpointModel {
		name?: string;
		description?: string;
		endpoint?: string;
		protocol?: string;
	}

	export interface IHttpResponse {
		method?: string;
		url?: string;
		statusCode?: number;
		statusMessage?: string;
	}

	export interface IEndPointsResponse {
		response: IHttpResponse;
		endPoints: IEndpointModel[];
	}

	export type AuthType = 'integrated' | 'basic';

	export interface IClusterController {
		getClusterConfig(): Promise<any>;
		getKnoxUsername(defaultUsername: string): Promise<string>;
		getEndPoints(promptConnect?: boolean): Promise<IEndPointsResponse>
		username: string;
		password: string;
	}
}
