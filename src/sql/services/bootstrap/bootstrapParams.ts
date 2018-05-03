/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataService } from 'sql/parts/grid/services/dataService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ConnectionContextkey } from 'sql/parts/connection/common/connectionContextKey';

export interface BootstrapParams {
}

export interface QueryComponentParams extends BootstrapParams {
	dataService: DataService;
}

export interface EditDataComponentParams extends BootstrapParams {
	dataService: DataService;
}

export interface DefaultComponentParams extends BootstrapParams {
	connection: IConnectionProfile;
	ownerUri: string;
	scopedContextService: IContextKeyService;
	connectionContextKey: ConnectionContextkey;
}

export interface DashboardComponentParams extends DefaultComponentParams {
}

export interface TaskDialogComponentParams extends BootstrapParams {
	ownerUri: string;
}

export interface QueryPlanParams extends BootstrapParams {
	planXml: string;
}
