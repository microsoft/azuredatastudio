/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobsView';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IAgentService } from '../common/interfaces';

export const DASHBOARD_SELECTOR: string = 'jobsview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobsView.component.html'))
})
export class JobsViewComponent implements OnInit, OnDestroy {

	private _agentService: IAgentService;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		this._agentService = bootstrapService.agentService;
	}

	ngOnInit() {
		//this._agentService.getJobs()
	}

	ngOnDestroy() {
	}
}
