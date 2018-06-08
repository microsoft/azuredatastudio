/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

import * as sqlops from 'sqlops';

export const IDashboardService = createDecorator<IDashboardService>('dashboardService');

export interface IDashboardService {

	_serviceBrand: any;
	readonly onDidOpenDashboard: Event<sqlops.DashboardDocument>;
	readonly onDidChangeToDashboard: Event<sqlops.DashboardDocument>;

	openDashboard(document: sqlops.DashboardDocument): void;

	changeToDashboard(document: sqlops.DashboardDocument): void;
}
