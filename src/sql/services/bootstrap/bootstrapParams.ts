/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataService } from 'sql/parts/grid/services/dataService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

export interface BootstrapParams {
}

export interface QueryComponentParams extends BootstrapParams {
	dataService: DataService;
}

export interface EditDataComponentParams extends BootstrapParams {
	dataService: DataService;
}

export interface DashboardComponentParams extends BootstrapParams {
	connection: IConnectionProfile;
	ownerUri: string;
	scopedContextService: IContextKeyService;
}

export interface TaskDialogComponentParams extends BootstrapParams {
	ownerUri: string;
}

export interface QueryPlanParams extends BootstrapParams {
	planXml: string;
}
