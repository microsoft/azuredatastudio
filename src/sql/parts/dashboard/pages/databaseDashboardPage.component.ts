/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Inject, forwardRef, ChangeDetectorRef, ElementRef } from '@angular/core';

import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { BreadcrumbClass } from 'sql/parts/dashboard/services/breadcrumb.service';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export class DatabaseDashboardPage extends DashboardPage implements OnInit {
	protected propertiesWidget: WidgetConfig = {
		name: nls.localize('databasePageName', 'DATABASE DASHBOARD'),
		widget: {
			'properties-widget': undefined
		},
		context: 'database',
		background_color: colors.editorBackground,
		border: 'none',
		fontSize: '14px',
		padding: '5px 0 0 0',
		provider: undefined,
		edition: undefined
	};

	protected readonly context = 'database';

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private _breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => CommonServiceInterface)) dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(INotificationService) notificationService: INotificationService,
		@Inject(IAngularEventingService) angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) configurationService: IConfigurationService
	) {
		super(dashboardService, el, _cd, instantiationService, notificationService, angularEventingService, configurationService);
		this._register(dashboardService.onUpdatePage(() => {
			this.refresh(true);
			this._cd.detectChanges();
		}));
	}

	ngOnInit() {
		this.init();
		this._breadcrumbService.setBreadcrumbs(BreadcrumbClass.DatabasePage);
	}
}
