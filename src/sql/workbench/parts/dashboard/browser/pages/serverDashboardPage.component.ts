/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Inject, forwardRef, ChangeDetectorRef, ElementRef } from '@angular/core';

import { DashboardPage } from 'sql/workbench/parts/dashboard/browser/core/dashboardPage.component';
import { BreadcrumbClass } from 'sql/workbench/parts/dashboard/browser/services/breadcrumb.service';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { WidgetConfig } from 'sql/workbench/parts/dashboard/browser/core/dashboardWidget';
import { DashboardServiceInterface } from 'sql/workbench/parts/dashboard/browser/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as nls from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

export class ServerDashboardPage extends DashboardPage implements OnInit {
	protected propertiesWidget: WidgetConfig = {
		name: nls.localize('serverPageName', "SERVER DASHBOARD"),
		widget: {
			'properties-widget': undefined
		},
		context: 'server',
		background_color: colors.editorBackground,
		border: 'none',
		fontSize: '14px',
		padding: '5px 0 0 0',
		provider: undefined,
		edition: undefined
	};

	protected readonly context = 'server';
	private _letDashboardPromise: Promise<void>;

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => CommonServiceInterface)) dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(INotificationService) notificationService: INotificationService,
		@Inject(IAngularEventingService) angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) configurationService: IConfigurationService,
		@Inject(ILogService) logService: ILogService
	) {
		super(dashboardService, el, _cd, instantiationService, notificationService, angularEventingService, configurationService, logService);

		// special-case handling for MSSQL data provider
		const connInfo = this.dashboardService.connectionManagementService.connectionInfo;
		if (connInfo && connInfo.providerId === mssqlProviderName) {
			// revert back to default database
			this._letDashboardPromise = this.dashboardService.connectionManagementService.changeDatabase('master').then();
		} else {
			this._letDashboardPromise = Promise.resolve();
		}
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
