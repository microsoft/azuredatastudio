/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Node Modules */
import { Injectable, Inject, forwardRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';

/* SQL imports */
import { DashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IMetadataService } from 'sql/services/metadata/metadataService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { toDisposableSubscription } from 'sql/parts/common/rxjsUtils';
import { IInsightsDialogService } from 'sql/parts/insights/common/interfaces';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { AngularEventType, IAngularEvent, IAngularEventingService } from 'sql/services/angularEventing/angularEventingService';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { TabSettingConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { IDashboardViewService } from 'sql/services/dashboard/common/dashboardViewService';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ConnectionContextkey } from 'sql/parts/connection/common/connectionContextKey';

import { ProviderMetadata, DatabaseInfo, SimpleExecuteResult } from 'sqlops';

/* VS imports */
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { ConfigurationEditingService, IConfigurationValue } from 'vs/workbench/services/configuration/node/configurationEditingService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IStorageService } from 'vs/platform/storage/common/storage';
import Event, { Emitter } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { deepClone } from 'vs/base/common/objects';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextKeyService, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INotificationService } from 'vs/platform/notification/common/notification';

const DASHBOARD_SETTINGS = 'dashboard';

/* Wrapper for a metadata service that contains the uri string to use on each request */
export class SingleConnectionMetadataService {

	constructor(
		private _metadataService: IMetadataService,
		private _uri: string
	) { }

	get metadata(): Observable<ProviderMetadata> {
		return Observable.fromPromise(this._metadataService.getMetadata(this._uri));
	}

	get databaseNames(): Observable<string[]> {
		return Observable.fromPromise(this._metadataService.getDatabaseNames(this._uri));
	}
}

/* Wrapper for a connection service that contains the uri string to use on each request */
export class SingleConnectionManagementService {

	constructor(
		private _connectionService: IConnectionManagementService,
		private _uri: string,
		private _contextKey: ConnectionContextkey
	) { }

	public changeDatabase(name: string): Thenable<boolean> {
		return this._connectionService.changeDatabase(this._uri, name).then(e => {
			// we need to update our context
			this._contextKey.set(this.connectionInfo.connectionProfile);
			return e;
		});
	}

	public get connectionInfo(): ConnectionManagementInfo {
		return this._connectionService.getConnectionInfo(this._uri);
	}
}

export class SingleAdminService {

	constructor(
		private _adminService: IAdminService,
		private _uri: string
	) { }

	public get databaseInfo(): Observable<DatabaseInfo> {
		return Observable.fromPromise(this._adminService.getDatabaseInfo(this._uri));
	}
}

export class SingleQueryManagementService {
	constructor(
		private _queryManagementService: IQueryManagementService,
		private _uri: string
	) { }

	public runQueryAndReturn(queryString: string): Thenable<SimpleExecuteResult> {
		return this._queryManagementService.runQueryAndReturn(this._uri, queryString);
	}
}

/*
	Providers a interface between a dashboard interface and the rest of carbon.
	Stores the uri and unique selector of a dashboard instance and uses that
	whenever a call to a carbon service needs this information, so that the widgets
	don't need to be aware of the uri or selector. Simplifies the initialization and
	usage of a widget.
*/
@Injectable()
export class DashboardServiceInterface extends AngularDisposable {
	private _uniqueSelector: string;
	private _uri: string;
	private _bootstrapParams: DashboardComponentParams;

	/* Static Services */
	private _themeService = this._bootstrapService.themeService;
	private _contextMenuService = this._bootstrapService.contextMenuService;
	private _instantiationService = this._bootstrapService.instantiationService;
	private _configService = this._bootstrapService.configurationService;
	private _insightsDialogService = this._bootstrapService.insightsDialogService;
	private _contextViewService = this._bootstrapService.contextViewService;
	private _notificationService = this._bootstrapService.notificationService;
	private _workspaceContextService = this._bootstrapService.workspaceContextService;
	private _storageService = this._bootstrapService.storageService;
	private _capabilitiesService = this._bootstrapService.capabilitiesService;
	private _configurationEditingService = this._bootstrapService.configurationEditorService;
	private _commandService = this._bootstrapService.commandService;
	private _dashboardViewService = this._bootstrapService.dashboardViewService;
	private _partService = this._bootstrapService.partService;
	private _angularEventingService = this._bootstrapService.angularEventingService;
	private _environmentService = this._bootstrapService.environmentService;

	/* Special Services */
	private _metadataService: SingleConnectionMetadataService;
	private _connectionManagementService: SingleConnectionManagementService;
	private _adminService: SingleAdminService;
	private _queryManagementService: SingleQueryManagementService;
	private _contextKeyService: IContextKeyService;

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

	private _connectionContextKey: ConnectionContextkey;

	private _numberOfPageNavigations = 0;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => Router)) private _router: Router,
	) {
		super();
	}

	public get notificationService(): INotificationService {
		return this._notificationService;
	}

	public get configurationEditingService(): ConfigurationEditingService {
		return this._configurationEditingService;
	}

	public get metadataService(): SingleConnectionMetadataService {
		return this._metadataService;
	}

	public get connectionManagementService(): SingleConnectionManagementService {
		return this._connectionManagementService;
	}

	public get commandService(): ICommandService {
		return this._commandService;
	}

	public get themeService(): IWorkbenchThemeService {
		return this._themeService;
	}

	public get contextMenuService(): IContextMenuService {
		return this._contextMenuService;
	}

	public get instantiationService(): IInstantiationService {
		return this._instantiationService;
	}

	public get dashboardViewService(): IDashboardViewService {
		return this._dashboardViewService;
	}

	public get partService(): IPartService {
		return this._partService;
	}

	public get contextKeyService(): IContextKeyService {
		return this._contextKeyService;
	}

	public get adminService(): SingleAdminService {
		return this._adminService;
	}

	public get queryManagementService(): SingleQueryManagementService {
		return this._queryManagementService;
	}

	public get environmentService(): IEnvironmentService {
		return this._environmentService;
	}

	public get contextViewService(): IContextViewService {
		return this._contextViewService;
	}

	public get workspaceContextService(): IWorkspaceContextService {
		return this._workspaceContextService;
	}

	public get storageService(): IStorageService {
		return this._storageService;
	}

	public get capabilitiesService(): ICapabilitiesService {
		return this._capabilitiesService;
	}

	public get angularEventingService(): IAngularEventingService {
		return this._angularEventingService;
	}

	/**
	 * Set the selector for this dashboard instance, should only be set once
	 */
	public set selector(selector: string) {
		this._uniqueSelector = selector;
		this._getbootstrapParams();
	}

	private _getbootstrapParams(): void {
		this._bootstrapParams = this._bootstrapService.getBootstrapParams<DashboardComponentParams>(this._uniqueSelector);
		this._contextKeyService = this._bootstrapParams.scopedContextService;
		this._connectionContextKey = this._bootstrapParams.connectionContextKey;
		this.dashboardContextKey = this._dashboardContextKey.bindTo(this._contextKeyService);
		this.uri = this._bootstrapParams.ownerUri;
	}

	/**
	 * Set the uri for this dashboard instance, should only be set once
	 * Inits all the services that depend on knowing a uri
	 */
	private set uri(uri: string) {
		this._uri = uri;
		this._metadataService = new SingleConnectionMetadataService(this._bootstrapService.metadataService, this._uri);
		this._connectionManagementService = new SingleConnectionManagementService(this._bootstrapService.connectionManagementService, this._uri, this._connectionContextKey);
		this._adminService = new SingleAdminService(this._bootstrapService.adminService, this._uri);
		this._queryManagementService = new SingleQueryManagementService(this._bootstrapService.queryManagementService, this._uri);
		this._register(toDisposableSubscription(this._bootstrapService.angularEventingService.onAngularEvent(this._uri, (event) => this.handleDashboardEvent(event))));
	}

	/**
	 * Gets the underlying Uri for dashboard
	 * In general don't use this, use specific services instances exposed publically
	 */
	public getUnderlyingUri(): string {
		return this._uri;
	}

	public getOriginalConnectionProfile(): IConnectionProfile {
		return this._bootstrapParams.connection;
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
		this._configurationEditingService.writeConfiguration(target, { key: [DASHBOARD_SETTINGS, type].join('.'), value });
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
