/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ServerInfo } from 'azdata';
import { DatabaseEngineEdition } from 'sql/workbench/api/common/sqlExtHostTypes';

export class ServerInfoContextKey implements IContextKey<ServerInfo> {

	static ServerInfo = new RawContextKey<ServerInfo>('serverInfo', undefined);
	static ServerMajorVersion = new RawContextKey<string>('serverMajorVersion', undefined);
	static IsCloud = new RawContextKey<boolean>('isCloud', undefined);
	static IsBigDataCluster = new RawContextKey<boolean>('isBigDataCluster', undefined);
	static EngineEdition = new RawContextKey<number>('engineEdition', undefined);

	private _serverInfo: IContextKey<ServerInfo>;
	private _serverMajorVersion: IContextKey<string>;
	private _isCloud: IContextKey<boolean>;
	private _isBigDataCluster: IContextKey<boolean>;
	private _engineEdition: IContextKey<number>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		this._serverInfo = ServerInfoContextKey.ServerInfo.bindTo(contextKeyService);
		this._serverMajorVersion = ServerInfoContextKey.ServerMajorVersion.bindTo(contextKeyService);
		this._isCloud = ServerInfoContextKey.IsCloud.bindTo(contextKeyService);
		this._isBigDataCluster = ServerInfoContextKey.IsBigDataCluster.bindTo(contextKeyService);
		this._engineEdition = ServerInfoContextKey.EngineEdition.bindTo(contextKeyService);
	}

	set(value: ServerInfo) {
		this._serverInfo.set(value);
		let majorVersion = value && value.serverMajorVersion;
		this._serverMajorVersion.set(majorVersion && `${majorVersion}`);
		this._isCloud.set(value && value.isCloud);
		this._isBigDataCluster.set(value && value.options && value.options['isBigDataCluster']);
		let engineEditionId = value && value.engineEditionId;
		engineEditionId ? this._engineEdition.set(engineEditionId) : this._engineEdition.set(DatabaseEngineEdition.Unknown);
	}

	reset(): void {
		this._serverMajorVersion.reset();
		this._isCloud.reset();
		this._isBigDataCluster.reset();
		this._engineEdition.reset();
	}

	public get(): ServerInfo {
		return this._serverInfo.get();
	}
}
