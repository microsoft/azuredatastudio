/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../../../../mssql/src/mssql';

export interface UpdateProjectDataModel {
	sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	targetEndpointInfo: mssql.SchemaCompareEndpointInfo;
	action: UpdateProjectAction;
}

export const enum UpdateProjectAction {
	Compare = 0,
	Update = 1
}
