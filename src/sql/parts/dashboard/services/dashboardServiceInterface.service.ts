/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Node Modules */
import { Injectable, Inject, forwardRef } from '@angular/core';
import { Router } from '@angular/router';

/* SQL imports */
import { IDashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { IMetadataService } from 'sql/platform/metadata/common/metadataService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IAdminService } from 'sql/workbench/services/admin/common/adminService';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { toDisposableSubscription } from 'sql/base/node/rxjsUtils';
import { AngularEventType, IAngularEvent, IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { TabSettingConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

/* VS imports */
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { Event, Emitter } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import { deepClone } from 'vs/base/common/objects';
import { RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { INotificationService } from 'vs/platform/notification/common/notification';

const DASHBOARD_SETTINGS = 'dashboard';

/*
	Providers a interface between a dashboard interface and the rest of carbon.
	Stores the uri and unique selector of a dashboard instance and uses that
	whenever a call to a carbon service needs this information, so that the widgets
	don't need to be aware of the uri or selector. Simplifies the initialization and
	usage of a widget.
*/
@Injectable()
export class DashboardServiceInterface extends CommonServiceInterface {

	/* Static Services */

	private _updatePage = new Emitter<void>();
	public readonly onUpdatePage: Event<void> = this._updatePage.event;

	private _onDeleteWidget = new Emitter<string>();
	public readonly onDeleteWidget: Event<string> = this._onDeleteWidget.event;

	private _onPinUnpinTab = new Emitter<TabSettingConfig>();
	public readonly onPinUnpinTab: Event<TabSettingConfig> = this._onPinUnpinTab.event;

	private _onAddNewTabs = new Emitter<Array<IDashboardTab>>();
	public readonly onAddNewTabs: Event<Array<IDashboardTab>> = this._onAddNewTabs.event;

	private _onCloseTab = new Emitter<string>();
	public readonly onCloseTab: Event<string> = this._onCloseTab.event;

	private _dashboardContextKey = new RawContextKey<string>('dashboardContext', undefined);
	public dashboardContextKey: IContextKey<string>;

	private _numberOfPageNavigations = 0;

	constructor(
		@Inject(IMetadataService) metadataService: IMetadataService,
		@Inject(IConnectionManagementService) connectionManagementService: IConnectionManagementService,
		@Inject(IAdminService) adminService: IAdminService,
		@Inject(IQueryManagementService) queryManagementService: IQueryManagementService,
		@Inject(IBootstrapParams) params: IDashboardComponentParams,
		@Inject(forwardRef(() => Router)) private _router: Router,
		@Inject(INotificationService) private _notificationService: INotificationService,
		@Inject(IAngularEventingService) private angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) private _configService: IConfigurationService
	) {
		super(params, metadataService, connectionManagementService, adminService, queryManagementService);
		// during testing there may not be params
		if (this._params) {
			this.dashboardContextKey = this._dashboardContextKey.bindTo(this.scopedContextKeyService);
			this._register(toDisposableSubscription(this.angularEventingService.onAngularEvent(this._uri, (event) => this.handleDashboardEvent(event))));
		}
	}

	/**
	 * Gets the number of page navigation
	 */
	public getNumberOfPageNavigations(): number {
		return this._numberOfPageNavigations;
	}

	/**
	 * Handle on page navigation
	 */
	public handlePageNavigation(): void {
		this._numberOfPageNavigations++;
	}

	/**
	 * Get settings for given string
	 * @param type string of setting to get from dashboard settings; i.e dashboard.{type}
	 */
	public getSettings<T>(type: string): T {
		let config = this._configService.getValue<T>([DASHBOARD_SETTINGS, type].join('.'));
		return deepClone(config);
	}

	public writeSettings(type: string, value: any, target: ConfigurationTarget) {
		this._configService.updateValue([DASHBOARD_SETTINGS, type].join('.'), value, target);
	}

	private handleDashboardEvent(event: IAngularEvent): void {
		switch (event.event) {
			case AngularEventType.NAV_DATABASE:
				this.connectionManagementService.changeDatabase(this.connectionManagementService.connectionInfo.connectionProfile.databaseName).then(
					result => {
						if (result) {
							if (this._router.url === '/database-dashboard') {
								this._updatePage.fire();
							} else {
								this._router.navigate(['database-dashboard']);
							}
						} else {
							this._notificationService.notify({
								severity: Severity.Error,
								message: nls.localize('dashboard.changeDatabaseFailure', "Failed to change database")
							});
						}
					},
					() => {
						this._notificationService.notify({
							severity: Severity.Error,
							message: nls.localize('dashboard.changeDatabaseFailure', "Failed to change database")
						});
					}
				);
				break;
			case AngularEventType.NAV_SERVER:
				this._router.navigate(['server-dashboard']);
				break;
			case AngularEventType.DELETE_WIDGET:
				this._onDeleteWidget.fire(event.payload.id);
				break;
			case AngularEventType.PINUNPIN_TAB:
				this._onPinUnpinTab.fire(event.payload);
				break;
			case AngularEventType.NEW_TABS:
				this._onAddNewTabs.fire(event.payload.dashboardTabs);
				break;
			case AngularEventType.CLOSE_TAB:
				this._onCloseTab.fire(event.payload.id);
		}
	}
}
