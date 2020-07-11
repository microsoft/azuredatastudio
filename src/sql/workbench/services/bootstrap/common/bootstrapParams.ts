/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataService } from 'sql/workbench/services/query/common/dataService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ConnectionContextKey } from 'sql/workbench/services/connection/common/connectionContextKey';
import { Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export interface IQueryComponentParams extends IBootstrapParams {
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

export const ISelector = 'selector';

export const IBootstrapParams = 'bootstrap_params';
export interface IBootstrapParams {
}

export interface Type<T> {
	new(...args: any[]): T;
}

export type IModuleFactory<T> = (params: IBootstrapParams, selector: string, service: IInstantiationService) => Type<T>;
