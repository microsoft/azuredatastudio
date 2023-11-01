/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export interface UpdateProjectDataModel {
	sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	targetEndpointInfo: mssql.SchemaCompareEndpointInfo;
	action: UpdateProjectAction;
}

export const enum UpdateProjectAction {
	Compare = 0,
	Update = 1
}
