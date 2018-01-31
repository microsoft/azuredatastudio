/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';

export const INewDashboardTabService = createDecorator<INewDashboardTabService>('addNewDashboardTabService');
export interface INewDashboardTabService {
	_serviceBrand: any;
	showDialog(dashboardTabs: Array<IDashboardTab>, uri: String): void;
}