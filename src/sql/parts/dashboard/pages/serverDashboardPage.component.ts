/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Inject, forwardRef, ChangeDetectorRef, ElementRef } from '@angular/core';

import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { BreadcrumbClass } from 'sql/parts/dashboard/services/breadcrumb.service';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as nls from 'vs/nls';

export class ServerDashboardPage extends DashboardPage implements OnInit {
	protected propertiesWidget: WidgetConfig = {
		name: nls.localize('serverPageName', 'SERVER DASHBOARD'),
		widget: {
			'properties-widget': undefined
		},
		context: 'server',
		background_color: colors.editorBackground,
		border: 'none',
		fontSize: '14px',
		fontWeight: '200',
		padding: '5px 0 0 0',
		provider: undefined,
		edition: undefined
	};

	protected readonly context = 'server';
	private _letDashboardPromise: Thenable<boolean>;

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private breadcrumbService: IBreadcrumbService,
		@Inject(BOOTSTRAP_SERVICE_ID) bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => DashboardServiceInterface)) dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(dashboardService, bootstrapService, el, _cd);
		// revert back to default database
		this._letDashboardPromise = this.dashboardService.connectionManagementService.changeDatabase('master');
	}

	ngOnInit() {
		this._letDashboardPromise.then(() => {
			this.breadcrumbService.setBreadcrumbs(BreadcrumbClass.ServerPage);
			this.dashboardService.connectionManagementService.connectionInfo.connectionProfile.databaseName = null;
			this.init();
			this._cd.detectChanges();
		});
	}
}
