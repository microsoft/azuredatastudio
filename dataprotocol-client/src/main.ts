import {
	LanguageClient, ServerOptions, LanguageClientOptions as VSLanguageClientOptions, DynamicFeature, ServerCapabilities, RegistrationData,
	RPCMessageType, Disposable,
} from 'vscode-languageclient';

import * as is from 'vscode-languageclient/lib/utils/is';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

import * as data from 'data';

import { c2p, Ic2p } from './codeConverter';

import  * as protocol from './protocol';
import * as types from './types';

function ensure<T, K extends keyof T>(target: T, key: K): T[K] {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
}

export interface LanguageClientOptions extends VSLanguageClientOptions {
	providerId: string;
}

/**
 *
 */
export abstract class SqlOpsFeature<T> implements DynamicFeature<T> {

	protected _providers: Map<string, Disposable> = new Map<string, Disposable>();

	constructor(protected _client: SqlOpsDataClient, private _message: RPCMessageType | RPCMessageType[]) {
	}

	public get messages(): RPCMessageType | RPCMessageType[] {
		return this._message;
	}

	public abstract fillClientCapabilities(capabilities: protocol.ClientCapabilities): void;

	public abstract initialize(capabilities: ServerCapabilities): void;

	public register(messages: RPCMessageType | RPCMessageType[], data: RegistrationData<T>): void {
		// Error catching
		if (is.array<RPCMessageType>(this.messages) && is.array<RPCMessageType>(messages)) {
			let valid = messages.every(v => !!(this.messages as RPCMessageType[]).find(i => i.method === v.method));
			if (!valid) {
				throw new Error(`Register called on wrong feature.`);
			}
		} else if (is.array<RPCMessageType>(this.messages) && !is.array<RPCMessageType>(messages)) {
			if (!this.messages.find(i => i.method === messages.method)) {
				throw new Error(`Register called on wrong feature.`);
			}
		} else if (!is.array<RPCMessageType>(this.messages) && !is.array<RPCMessageType>(messages)) {
			if (this.messages.method !== messages.method) {
				throw new Error(`Register called on wrong feature. Requested ${messages.method} but reached feature ${this.messages.method}`);
			}
		}

		let provider = this.registerProvider(data.registerOptions);
		if (provider) {
			this._providers.set(data.id, provider);
		}
	}

	protected abstract registerProvider(options: T): Disposable;

	public unregister(id: string): void {
		let provider = this._providers.get(id);
		if (provider) {
			provider.dispose();
		}
	}

	public dispose(): void {
		this._providers.forEach((value) => {
			value.dispose();
		});
	}
}

class CapabilitiesFeature extends SqlOpsFeature<undefined> {

	private static readonly messagesTypes: RPCMessageType[] = [
		protocol.CapabiltiesDiscoveryRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, CapabilitiesFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: protocol.ClientCapabilities): void {
		ensure(ensure(capabilities, 'connection')!, 'capabilities')!.dynamicRegistration = true;
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		let client = this._client;

		let getServerCapabilities = (cap: data.DataProtocolClientCapabilities): Thenable<data.DataProtocolServerCapabilities> => {
			return client.sendRequest(protocol.CapabiltiesDiscoveryRequest.type, client.sqlc2p.asCapabilitiesParams(cap)).then(
				r => r.capabilities as any,
				e => {
					client.logFailedRequest(protocol.CapabiltiesDiscoveryRequest.type, e);
					return Promise.resolve([]);
				}
			);
		};

		return data.dataprotocol.registerCapabilitiesServiceProvider({
			providerId: client.providerId,
			getServerCapabilities
		});
	}
}

class ConnectionFeature extends SqlOpsFeature<undefined> {

	private static readonly messagesTypes: RPCMessageType[] = [
		protocol.ConnectionRequest.type,
		protocol.ConnectionCompleteNotification.type,
		protocol.ConnectionChangedNotification.type,
		protocol.DisconnectRequest.type,
		protocol.CancelConnectRequest.type,
		protocol.ChangeDatabaseRequest.type,
		protocol.ListDatabasesRequest.type,
		protocol.LanguageFlavorChangedNotification.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, ConnectionFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: protocol.ClientCapabilities): void {
		ensure(ensure(capabilities, 'connection')!, 'connection')!.dynamicRegistration = true;
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		let client = this._client;
		let connect = (connUri: string, connInfo: data.ConnectionInfo): Thenable<boolean> => {
			return client.sendRequest(protocol.ConnectionRequest.type, client.sqlc2p.asConnectionParams(connUri, connInfo)).then(
				undefined,
				e => {
					client.logFailedRequest(protocol.ConnectionRequest.type, e);
					return Promise.resolve(false);
				}
			);
		};

		let disconnect = (connUri: string): Thenable<boolean> => {
			let params: protocol.DisconnectParams = {
				ownerUri: connUri
			};

			return client.sendRequest(protocol.DisconnectRequest.type, params).then(
				undefined,
				e => {
					client.logFailedRequest(protocol.DisconnectRequest.type, e);
					return Promise.resolve(false);
				}
			);
		};

		let cancelConnect = (connUri: string): Thenable<boolean> => {
			let params: protocol.CancelConnectParams = {
				ownerUri: connUri
			};

			return client.sendRequest(protocol.CancelConnectRequest.type, params).then(
				undefined,
				e => {
					client.logFailedRequest(protocol.CancelConnectRequest.type, e);
					return Promise.resolve(false);
				}
			);
		};

		let changeDatabase = (connUri: string, newDatabase: string): Thenable<boolean> => {
			let params: protocol.ChangeDatabaseParams = {
				ownerUri: connUri,
				newDatabase: newDatabase
			};

			return client.sendRequest(protocol.ChangeDatabaseRequest.type, params).then(
				undefined,
				e => {
					client.logFailedRequest(protocol.ChangeDatabaseRequest.type, e);
					return Promise.resolve(false);
				}
			);
		};

		let listDatabases = (connectionUri: string): Thenable<data.ListDatabasesResult> => {
			let params: protocol.ListDatabasesParams = {
				ownerUri: connectionUri
			};

			return client.sendRequest(protocol.ListDatabasesRequest.type, params).then(
				undefined,
				e => {
					client.logFailedRequest(protocol.ListDatabasesRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let rebuildIntelliSenseCache = (connectionUri: string): Thenable<void> => {
			let params: protocol.RebuildIntelliSenseParams = {
				ownerUri: connectionUri
			};

			client.sendNotification(protocol.RebuildIntelliSenseNotification.type, params);
			return Promise.resolve();
		};

		let registerOnConnectionComplete = (handler: (connSummary: data.ConnectionInfoSummary) => any): void => {
			client.onNotification(protocol.ConnectionCompleteNotification.type, (params: types.ConnectionCompleteParams) => {
				handler({
					ownerUri: params.ownerUri,
					connectionId: params.connectionId,
					messages: params.messages,
					errorMessage: params.errorMessage,
					errorNumber: params.errorNumber,
					serverInfo: params.serverInfo,
					connectionSummary: params.connectionSummary
				});
			});
		};

		let registerOnIntelliSenseCacheComplete = (handler: (connectionUri: string) => any): void => {
			client.onNotification(protocol.IntelliSenseReadyNotification.type, (params: types.IntelliSenseReadyParams) => {
				handler(params.ownerUri);
			});
		};

		let registerOnConnectionChanged = (handler: (changedConnInfo: data.ChangedConnectionInfo) => any): void => {
			client.onNotification(protocol.ConnectionChangedNotification.type, (params: protocol.ConnectionChangedParams) => {
				handler({
					connectionUri: params.ownerUri,
					connection: params.connection
				});
			});
		};

		return data.dataprotocol.registerConnectionProvider({
			providerId: client.providerId,
			connect,
			disconnect,
			cancelConnect,
			changeDatabase,
			listDatabases,
			rebuildIntelliSenseCache,
			registerOnConnectionChanged,
			registerOnIntelliSenseCacheComplete,
			registerOnConnectionComplete
		});
	}
}

/**
 *
 */
export class SqlOpsDataClient extends LanguageClient {

	private _sqlc2p: Ic2p;
	private _providerId: string;

	public get sqlc2p(): Ic2p {
		return this._sqlc2p;
	}

	public get providerId(): string {
		return this._providerId;
	}

	public constructor(name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
	public constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
	public constructor(arg1: string, arg2: ServerOptions | string, arg3: LanguageClientOptions | ServerOptions, arg4?: boolean | LanguageClientOptions, arg5?: boolean) {
		if (typeof arg2 === 'string') {
			super(arg1, arg2, arg3 as ServerOptions, arg4 as LanguageClientOptions, arg5);
			this._providerId = (arg4 as LanguageClientOptions).providerId;
		} else {
			super(arg1, arg2 as ServerOptions, arg3 as LanguageClientOptions, arg4 as boolean);
			this._providerId = (arg3 as LanguageClientOptions).providerId;
		}
		this._sqlc2p = c2p;
		this.registerDataFeatures();
	}

	private registerDataFeatures() {
		this.registerFeature(new ConnectionFeature(this));
		this.registerFeature(new CapabilitiesFeature(this));
	}
}
