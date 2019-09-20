/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Node Modules */
import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs/Observable';

/* SQL imports */
import { IDefaultComponentParams, IBootstrapParams } from 'sql/platform/bootstrap/common/bootstrapParams';
import { IMetadataService } from 'sql/platform/metadata/common/metadataService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { IAdminService } from 'sql/workbench/services/admin/common/adminService';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { ConnectionContextKey } from 'sql/workbench/parts/connection/common/connectionContextKey';

import { ProviderMetadata, DatabaseInfo, SimpleExecuteResult } from 'azdata';

/* VS imports */
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

/* Wrapper for a metadata service that contains the uri string to use on each request */
export class SingleConnectionMetadataService {

	constructor(
		private _metadataService: IMetadataService,
		private _uri: string
	) { }

	get metadata(): Observable<ProviderMetadata | undefined> {
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
		private _contextKey: ConnectionContextKey
	) { }

	public changeDatabase(name: string): Promise<boolean> {
		return Promise.resolve(this._connectionService.changeDatabase(this._uri, name).then(e => {
			// we need to update our context
			this._contextKey.set(this.connectionInfo.connectionProfile);
			return e;
		}));
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
	protected _uri: string;

	/* Special Services */
	protected _singleMetadataService: SingleConnectionMetadataService;
	protected _singleConnectionManagementService: SingleConnectionManagementService;
	protected _singleAdminService: SingleAdminService;
	protected _singleQueryManagementService: SingleQueryManagementService;
	public scopedContextKeyService: IContextKeyService;

	protected _connectionContextKey: ConnectionContextKey;

	constructor(
		@Inject(IBootstrapParams) protected _params: IDefaultComponentParams,
		@Inject(IMetadataService) protected _metadataService: IMetadataService,
		@Inject(IConnectionManagementService) protected _connectionManagementService: IConnectionManagementService,
		@Inject(IAdminService) protected _adminService: IAdminService,
		@Inject(IQueryManagementService) protected _queryManagementService: IQueryManagementService
	) {
		super();
		// during testing there may not be params
		if (this._params) {
			this.scopedContextKeyService = this._params.scopedContextService;
			this._connectionContextKey = this._params.connectionContextKey;
			this.uri = this._params.ownerUri;
		}
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
		return this._params.connection;
	}
}
