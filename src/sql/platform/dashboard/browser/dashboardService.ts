/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import * as azdata from 'azdata';

export const IDashboardService = createDecorator<IDashboardService>('dashboardService');

export interface IDashboardService {

	_serviceBrand: undefined;
	readonly onDidOpenDashboard: Event<azdata.DashboardDocument>;
	readonly onDidChangeToDashboard: Event<azdata.DashboardDocument>;
	readonly onLayout: Event<DOM.Dimension>;

	openDashboard(document: azdata.DashboardDocument): void;

	changeToDashboard(document: azdata.DashboardDocument): void;

	layout(dimension: DOM.Dimension): void;
}
