/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Node Modules */
import { Injectable, Inject, forwardRef, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs/Observable';

/* SQL imports */
import { DefaultComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IMetadataService } from 'sql/services/metadata/metadataService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ConnectionContextkey } from 'sql/parts/connection/common/connectionContextKey';

import { ProviderMetadata, DatabaseInfo, SimpleExecuteResult } from 'sqlops';

/* VS imports */
import { IContextKeyService, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';

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

	/* Special Services */
	protected _singleMetadataService: SingleConnectionMetadataService;
	protected _singleConnectionManagementService: SingleConnectionManagementService;
	protected _singleAdminService: SingleAdminService;
	protected _singleQueryManagementService: SingleQueryManagementService;
	public scopedContextKeyService: IContextKeyService;

	protected _connectionContextKey: ConnectionContextkey;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) protected _bootstrapService: IBootstrapService,
		@Inject(IMetadataService) protected _metadataService: IMetadataService,
		@Inject(IConnectionManagementService) protected _connectionManagementService: IConnectionManagementService,
		@Inject(IAdminService) protected _adminService: IAdminService,
		@Inject(IQueryManagementService) protected _queryManagementService: IQueryManagementService
	) {
		super();
	}

	public get metadataService(): SingleConnectionMetadataService {
		return this._singleMetadataService;
	}

	public get connectionManagementService(): SingleConnectionManagementService {
		return this._singleConnectionManagementService;
	}

	public get adminService(): SingleAdminService {
		return this._singleAdminService;
	}

	public get queryManagementService(): SingleQueryManagementService {
		return this._singleQueryManagementService;
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
		this.scopedContextKeyService = this._bootstrapParams.scopedContextService;
		this._connectionContextKey = this._bootstrapParams.connectionContextKey;
		this.uri = this._bootstrapParams.ownerUri;
	}

	protected setUri(uri: string) {
		this._uri = uri;
		this._singleMetadataService = new SingleConnectionMetadataService(this._metadataService, this._uri);
		this._singleConnectionManagementService = new SingleConnectionManagementService(this._connectionManagementService, this._uri, this._connectionContextKey);
		this._singleAdminService = new SingleAdminService(this._adminService, this._uri);
		this._singleQueryManagementService = new SingleQueryManagementService(this._queryManagementService, this._uri);
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
