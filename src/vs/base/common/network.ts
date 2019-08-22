/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as platform from 'vs/base/common/platform';

export namespace Schemas {

	/**
	 * A schema that is used for models that exist in memory
	 * only and that have no correspondence on a server or such.
	 */
	export const inMemory: string = 'inmemory';

	/**
	 * A schema that is used for setting files
	 */
	export const vscode: string = 'vscode';

	/**
	 * A schema that is used for internal private files
	 */
	export const internal: string = 'private';

	/**
	 * A walk-through document.
	 */
	export const walkThrough: string = 'walkThrough';

	/**
	 * An embedded code snippet.
	 */
	export const walkThroughSnippet: string = 'walkThroughSnippet';

	export const http: string = 'http';

	export const https: string = 'https';

	export const file: string = 'file';

	export const mailto: string = 'mailto';

	export const untitled: string = 'untitled';

	export const data: string = 'data';

	export const command: string = 'command';

	export const vscodeRemote: string = 'vscode-remote';

	export const vscodeRemoteResource: string = 'vscode-remote-resource';

	export const userData: string = 'vscode-userdata';
}

class RemoteAuthoritiesImpl {
	private readonly _hosts: { [authority: string]: string; };
	private readonly _ports: { [authority: string]: number; };
	private readonly _connectionTokens: { [authority: string]: string; };
	private _preferredWebSchema: 'http' | 'https';

	constructor() {
		this._hosts = Object.create(null);
		this._ports = Object.create(null);
		this._connectionTokens = Object.create(null);
		this._preferredWebSchema = 'http';
	}

	public setPreferredWebSchema(schema: 'http' | 'https') {
		this._preferredWebSchema = schema;
	}

	public set(authority: string, host: string, port: number): void {
		this._hosts[authority] = host;
		this._ports[authority] = port;
	}

	public setConnectionToken(authority: string, connectionToken: string): void {
		this._connectionTokens[authority] = connectionToken;
	}

	public rewrite(authority: string, path: string): URI {
		const host = this._hosts[authority];
		const port = this._ports[authority];
		const connectionToken = this._connectionTokens[authority];
		return URI.from({
			scheme: platform.isWeb ? this._preferredWebSchema : Schemas.vscodeRemoteResource,
			authority: `${host}:${port}`,
			path: `/vscode-remote-resource`,
			query: `path=${encodeURIComponent(path)}&tkn=${encodeURIComponent(connectionToken)}`
		});
	}
}

export const RemoteAuthorities = new RemoteAuthoritiesImpl();
