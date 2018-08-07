/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ServerInfo } from 'sqlops';

export class ServerInfoContextKey implements IContextKey<ServerInfo> {

	static ServerInfo = new RawContextKey<ServerInfo>('serverInfo', undefined);
	static ServerMajorVersion = new RawContextKey<number>('serverMajorVersion', undefined);
	static ServerMinorVersion = new RawContextKey<number>('serverMinorVersion', undefined);
	static IsCloud = new RawContextKey<boolean>('isCloud', undefined);

	private _serverInfoKey: IContextKey<ServerInfo>;
	private _serverMajorVersion: IContextKey<number>;
	private _serverMinorVersion: IContextKey<number>;
	private _isCloud: IContextKey<boolean>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		this._serverInfoKey = ServerInfoContextKey.ServerInfo.bindTo(contextKeyService);
		this._serverMajorVersion = ServerInfoContextKey.ServerMajorVersion.bindTo(contextKeyService);
		this._serverMinorVersion = ServerInfoContextKey.ServerMinorVersion.bindTo(contextKeyService);
		this._isCloud = ServerInfoContextKey.IsCloud.bindTo(contextKeyService);
	}

	set(value: ServerInfo) {
		this._serverInfoKey.set(value);
		this._serverMajorVersion.set(value && value.serverMajorVersion);
		this._serverMinorVersion.set(value && value.serverMinorVersion);
		this._isCloud.set(value && value.isCloud);
	}

	reset(): void {
		this._serverInfoKey.reset();
		this._serverMajorVersion.reset();
		this._serverMinorVersion.reset();
		this._isCloud.reset();
	}

	public get(): ServerInfo {
		return this._serverInfoKey.get();
	}
}
