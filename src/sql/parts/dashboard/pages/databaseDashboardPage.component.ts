/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Inject, forwardRef, ChangeDetectorRef, OnDestroy } from '@angular/core';

import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { BreadcrumbClass } from 'sql/parts/dashboard/services/breadcrumb.service';
import { IBreadcrumbService } from 'sql/base/browser/ui/breadcrumb/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';

import * as colors from 'vs/platform/theme/common/colorRegistry';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';

export class DatabaseDashboardPage extends DashboardPage implements OnInit, OnDestroy {
	protected propertiesWidget: WidgetConfig = {
		name: nls.localize('databasePageName', 'DATABASE DASHBOARD'),
		widget: {
			'properties-widget': undefined
		},
		context: 'database',
		background_color: colors.editorBackground,
		border: 'none',
		fontSize: '14px',
		fontWeight: '200',
		padding: '5px 0 0 0',
		provider: undefined,
		edition: undefined
	};

	protected readonly context = 'database';
	private _dispose: IDisposable[] = [];

	constructor(
		@Inject(forwardRef(() => IBreadcrumbService)) private _breadcrumbService: IBreadcrumbService,
		@Inject(forwardRef(() => DashboardServiceInterface)) dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef
	) {
		super(dashboardService);
		this._dispose.push(dashboardService.onUpdatePage(() => {
			this.refresh(true);
			this._cd.detectChanges();
		}));
		this.init();
	}

	ngOnInit() {
		this._breadcrumbService.setBreadcrumbs(BreadcrumbClass.DatabasePage);
		this.baseInit();
	}

	ngOnDestroy() {
		this._dispose = dispose(this._dispose);
		this.baseDestroy();
	}
}
