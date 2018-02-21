/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, forwardRef } from '@angular/core';

import { DashboardWidgetTab } from 'sql/parts/dashboard/tabs/dashboardWidgetTab.component';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';

@Component({
	selector: 'dashboard-home-tab',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardHomeTab) }],
	template: `
		<dashboard-widget-wrapper #properties *ngIf="propertiesWidget" [_config]="propertiesWidget" style="padding-left: 10px; padding-right: 10px; height: 90px; display: block">
		</dashboard-widget-wrapper>
		<widget-content [widgets]="widgets" [originalConfig]="tab.originalConfig" [context]="tab.context">
		</widget-content>
	`
})
export class DashboardHomeTab extends DashboardWidgetTab {
	@input() private properties

}
