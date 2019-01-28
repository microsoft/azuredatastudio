/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataService } from 'sql/parts/grid/services/dataService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ConnectionContextKey } from 'sql/parts/connection/common/connectionContextKey';
import { IBootstrapParams } from './bootstrapService';
import { Event } from 'vs/base/common/event';

export interface IQueryComponentParams extends IBootstrapParams {
	dataService: DataService;
	onSaveViewState: Event<void>;
	onRestoreViewState: Event<void>;
}

export interface IEditDataComponentParams extends IBootstrapParams {
	dataService: DataService;
	onSaveViewState: Event<void>;
	onRestoreViewState: Event<void>;
}

export interface IDefaultComponentParams extends IBootstrapParams {
	connection: IConnectionProfile;
	ownerUri: string;
	scopedContextService: IContextKeyService;
	connectionContextKey: ConnectionContextKey;
}

export interface IDashboardComponentParams extends IDefaultComponentParams {
}

export interface ITaskDialogComponentParams extends IBootstrapParams {
	ownerUri: string;
}

export interface IQueryPlanParams extends IBootstrapParams {
	planXml: string;
}
