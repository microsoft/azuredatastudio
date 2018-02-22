/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardHomeTab';

import { Component, forwardRef, Input } from '@angular/core';

import { DashboardWidgetTab } from 'sql/parts/dashboard/tabs/dashboardWidgetTab.component';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';

@Component({
	selector: 'dashboard-home-tab',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardHomeTab) }],
	template: `
		<div class="scroll-container" #scrollContainer>
			<div class="scrollable" #scrollable>
				<dashboard-widget-wrapper *ngIf="properties" [_config]="properties" style="padding-left: 10px; padding-right: 10px; height: 90px; display: block">
				</dashboard-widget-wrapper>
				<widget-content [widgets]="widgets" [originalConfig]="tab.originalConfig" [context]="tab.context">
				</widget-content>
			</div>
		</div>
	`
})
export class DashboardHomeTab extends DashboardWidgetTab {
	@Input() private properties: WidgetConfig;
}
