/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Node Modules */
import { Injectable, Inject, forwardRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs/Observable';

/* SQL imports */
import { DefaultComponentParams } from 'sql/services/bootstrap/bootstrapParams';
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
import { IModelViewService } from 'sql/services/modelComponents/modelViewService';
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
	Providers a interface between a UI interface and the rest of carbon.
	Stores the uri and unique selector of a UI instance and uses that
	whenever a call to a carbon service needs this information, so that the widgets
	don't need to be aware of the uri or selector. Simplifies the initialization and
	usage of a widget.
*/
@Injectable()
export class CommonServiceInterface extends AngularDisposable {
	protected _uniqueSelector: string;
	protected _uri: string;
	protected _bootstrapParams: DefaultComponentParams;

	/* Static Services */
	protected _themeService = this._bootstrapService.themeService;
	protected _contextMenuService = this._bootstrapService.contextMenuService;
	protected _instantiationService = this._bootstrapService.instantiationService;
	protected _configService = this._bootstrapService.configurationService;
	protected _insightsDialogService = this._bootstrapService.insightsDialogService;
	protected _contextViewService = this._bootstrapService.contextViewService;
	protected _notificationService = this._bootstrapService.notificationService;
	protected _workspaceContextService = this._bootstrapService.workspaceContextService;
	protected _storageService = this._bootstrapService.storageService;
	protected _capabilitiesService = this._bootstrapService.capabilitiesService;
	protected _configurationEditingService = this._bootstrapService.configurationEditorService;
	protected _commandService = this._bootstrapService.commandService;
	protected _modelViewService = this._bootstrapService.modelViewService;
	protected _partService = this._bootstrapService.partService;
	protected _angularEventingService = this._bootstrapService.angularEventingService;
	protected _environmentService = this._bootstrapService.environmentService;

	/* Special Services */
	protected _metadataService: SingleConnectionMetadataService;
	protected _connectionManagementService: SingleConnectionManagementService;
	protected _adminService: SingleAdminService;
	protected _queryManagementService: SingleQueryManagementService;
	protected _contextKeyService: IContextKeyService;

	protected _connectionContextKey: ConnectionContextkey;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) protected _bootstrapService: IBootstrapService
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

	public get modelViewService(): IModelViewService {
		return this._modelViewService;
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
	 * Set the selector for this instance, should only be set once
	 */
	public set selector(selector: string) {
		this._uniqueSelector = selector;
		this._getbootstrapParams();
	}

	protected _getbootstrapParams(): void {
		this._bootstrapParams = this._bootstrapService.getBootstrapParams<DefaultComponentParams>(this._uniqueSelector);
		this._contextKeyService = this._bootstrapParams.scopedContextService;
		this._connectionContextKey = this._bootstrapParams.connectionContextKey;
		this.uri = this._bootstrapParams.ownerUri;
	}

	protected setUri(uri: string) {
		this._uri = uri;
		this._metadataService = new SingleConnectionMetadataService(this._bootstrapService.metadataService, this._uri);
		this._connectionManagementService = new SingleConnectionManagementService(this._bootstrapService.connectionManagementService, this._uri, this._connectionContextKey);
		this._adminService = new SingleAdminService(this._bootstrapService.adminService, this._uri);
		this._queryManagementService = new SingleQueryManagementService(this._bootstrapService.queryManagementService, this._uri);
	}

	/**
	 * Set the uri for this instance, should only be set once
	 * Inits all the services that depend on knowing a uri
	 */
	protected set uri(uri: string) {
		this.setUri(uri);
	}

	protected get uri(): string {
		return this._uri;
	}

	/**
	 * Gets the underlying Uri
	 * In general don't use this, use specific services instances exposed publicly
	 */
	public getUnderlyingUri(): string {
		return this._uri;
	}

	public getOriginalConnectionProfile(): IConnectionProfile {
		return this._bootstrapParams.connection;
	}
}
