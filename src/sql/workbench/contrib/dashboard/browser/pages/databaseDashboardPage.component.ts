/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Inject, forwardRef, ChangeDetectorRef, ElementRef } from '@angular/core';

import { DashboardPage } from 'sql/workbench/contrib/dashboard/browser/core/dashboardPage.component';
import { BreadcrumbClass } from 'sql/workbench/contrib/dashboard/browser/services/breadcrumb.service';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IAngularEventingService } from 'sql/platform/angularEventing/browser/angularEventingService';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as nls from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { BackupToolbarAction } from 'sql/workbench/contrib/dashboard/browser/core/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

export class DatabaseDashboardPage extends DashboardPage implements OnInit {
	protected propertiesWidget: WidgetConfig = {
		name: nls.localize('databasePageName', "DATABASE DASHBOARD"),
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
	protected _backupAction: BackupToolbarAction;

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private _breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => CommonServiceInterface)) dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(INotificationService) notificationService: INotificationService,
		@Inject(IAngularEventingService) angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) configurationService: IConfigurationService,
		@Inject(ILogService) logService: ILogService,
		@Inject(IInstantiationService) _instantiationService: IInstantiationService,
		@Inject(ICommandService) commandService: ICommandService,
		@Inject(IContextKeyService) contextKeyService: IContextKeyService
	) {
		super(dashboardService, el, _cd, notificationService, angularEventingService, configurationService, logService, _instantiationService, commandService, contextKeyService);
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
