/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../common/media/jobs';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IJobManagementService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { AgentJobInfo } from 'sqlops';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import * as nls from 'vs/nls';

export const DASHBOARD_SELECTOR: string = 'agentview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./agentView.component.html'))
})
export class AgentViewComponent {

	@ViewChild(PanelComponent) private _panel: PanelComponent;

	// tslint:disable:no-unused-variable
	private readonly jobsComponentTitle: string = nls.localize('jobview.Jobs', "Jobs");
	private readonly alertsComponentTitle: string = nls.localize('jobview.Alerts', "Alerts");
	private readonly schedulesComponentTitle: string = nls.localize('jobview.Schedules', "Schedules");
	private readonly operatorsComponentTitle: string = nls.localize('jobview.Operator', "Operators");
	private readonly jobHistoryComponentTitle: string = nls.localize('jobview.History', "History");

	private readonly jobsTabIdentifier = 'jobs';
	private readonly alertsTabIdentifier = 'alerts';
	private readonly schedulesTabIdentifier = 'schedules';
	private readonly operatorTabIdentifier = 'operators';
	private readonly historyTabIdentifier = 'history';
	// tslint:enable:no-unused-variable

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		showTabsWhenOne: true,
		layout: NavigationBarLayout.vertical
	};
}
