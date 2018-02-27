/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardHomeContainer';

import { Component, forwardRef, Input } from '@angular/core';

import { DashboardWidgetContainer } from 'sql/parts/dashboard/containers/dashboardWidgetContainer.component';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';

@Component({
	selector: 'dashboard-home-container',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardHomeContainer) }],
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
export class DashboardHomeContainer extends DashboardWidgetContainer {
	@Input() private properties: WidgetConfig;
}
