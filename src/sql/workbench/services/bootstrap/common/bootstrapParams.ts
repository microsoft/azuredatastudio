/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataService } from 'sql/workbench/contrib/grid/common/dataService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ConnectionContextKey } from 'sql/workbench/contrib/connection/common/connectionContextKey';
import { Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';

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
	connection: ConnectionProfile;
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
