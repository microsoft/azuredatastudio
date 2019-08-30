/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardTab } from 'sql/platform/dashboard/browser/dashboardRegistry';

export const INewDashboardTabDialogService = createDecorator<INewDashboardTabDialogService>('addNewDashboardTabService');
export interface INewDashboardTabDialogService {
	_serviceBrand: undefined;
	showDialog(dashboardTabs: Array<IDashboardTab>, openedTabs: Array<IDashboardTab>, uri: string): void;
}
