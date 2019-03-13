/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ServerInfo } from 'azdata';

export class ServerInfoContextKey implements IContextKey<ServerInfo> {

	static ServerInfoObj = new RawContextKey<ServerInfo>('serverInfoObj', undefined);
	static ServerMajorVersion = new RawContextKey<string>('serverMajorVersion', undefined);

	private _serverInfoObj: IContextKey<ServerInfo>;
	private _serverMajorVersion: IContextKey<string>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		this._serverInfoObj = ServerInfoContextKey.ServerInfoObj.bindTo(contextKeyService);
		this._serverMajorVersion = ServerInfoContextKey.ServerMajorVersion.bindTo(contextKeyService);
	}

	set(value: ServerInfo) {
		this._serverInfoObj.set(value);
		let majorVersion = value && value.serverMajorVersion;
		this._serverMajorVersion.set(majorVersion && `${majorVersion}`);
	}

	reset(): void {
		this._serverMajorVersion.reset();
	}

	public get(): ServerInfo {
		return this._serverInfoObj.get();
	}
}
