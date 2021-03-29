/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationTargetType } from './stateMachine';

export interface Base {
	uuid: string;
}

export interface BaseRequest extends Base { }

export interface BaseResponse<T> extends Base {
	error?: string;
	response: T;
}

export interface GatherInformationRequest extends BaseRequest {
	connection: azdata.connection.Connection;
}

export interface Checks {

}

export interface SKURecommendation {
	product: MigrationTargetType;
	checks: Checks;
}

export interface SKURecommendations {
	recommendations: SKURecommendation[];
}

export interface GatherInformationResponse extends BaseResponse<SKURecommendations> {
}

