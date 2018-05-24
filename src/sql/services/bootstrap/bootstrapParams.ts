/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataService } from 'sql/parts/grid/services/dataService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ConnectionContextkey } from 'sql/parts/connection/common/connectionContextKey';
import { IBootstrapParams } from './bootstrapService';

export interface IQueryComponentParams extends IBootstrapParams {
	dataService: DataService;
}

export interface IEditDataComponentParams extends IBootstrapParams {
	dataService: DataService;
}

export interface IDefaultComponentParams extends IBootstrapParams {
	connection: IConnectionProfile;
	ownerUri: string;
	scopedContextService: IContextKeyService;
	connectionContextKey: ConnectionContextkey;
}

export interface IDashboardComponentParams extends IDefaultComponentParams {
}

export interface ITaskDialogComponentParams extends IBootstrapParams {
	ownerUri: string;
}

export interface IQueryPlanParams extends IBootstrapParams {
	planXml: string;
}
