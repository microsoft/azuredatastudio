import {
	LanguageClient, ServerOptions, LanguageClientOptions as VSLanguageClientOptions
} from 'vscode-languageclient';

import * as is from 'vscode-languageclient/lib/utils/is';

import { c2p, Ic2p } from './codeConverter';

import { Ip2c, p2c } from './protocolConverter';

export * from './features';

export interface LanguageClientOptions extends VSLanguageClientOptions {
	providerId: string;
	serverConnectionMetadata: any;
}

/**
 *
 */
export class SqlOpsDataClient extends LanguageClient {

	private _sqlc2p: Ic2p;
	private _sqlp2c: Ip2c;
	private _providerId: string;

	public get sqlc2p(): Ic2p {
		return this._sqlc2p;
	}

	public get sqlp2c(): Ip2c {
		return this._sqlp2c;
	}

	public get providerId(): string {
		return this._providerId;
	}

	public constructor(name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
	public constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
	public constructor(arg1: string, arg2: ServerOptions | string, arg3: LanguageClientOptions | ServerOptions, arg4?: boolean | LanguageClientOptions, arg5?: boolean) {
		if (is.string(arg2)) {
			super(arg1, arg2, arg3 as ServerOptions, arg4 as LanguageClientOptions, arg5);
			this._providerId = (arg4 as LanguageClientOptions).providerId;
		} else {
			super(arg1, arg2 as ServerOptions, arg3 as LanguageClientOptions, arg4 as boolean);
			this._providerId = (arg3 as LanguageClientOptions).providerId;
		}
		this._sqlc2p = c2p;
		this._sqlp2c = p2c;
	}
}
