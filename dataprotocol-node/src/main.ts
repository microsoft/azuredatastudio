import {
	LanguageClient, ServerOptions, LanguageClientOptions, DynamicFeature, ServerCapabilities, RegistrationData,
	RPCMessageType, Disposable
} from 'vscode-languageclient';

import { ClientCapabilities, ConnectionRequest, ConnectionCompleteNotification, ConnectionChangedNotification, DisconnectRequest, CancelConnectRequest, ChangeDatabaseRequest, ListDatabasesRequest, LanguageFlavorChangedNotification } from './protocol';

import { dataprotocol } from 'data';

function ensure<T, K extends keyof T>(target: T, key: K): T[K] {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
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

	public abstract fillClientCapabilities(capabilities: ClientCapabilities): void;

	public abstract initialize(capabilities: ServerCapabilities): void;

	register(message: RPCMessageType, data: RegistrationData<T>): void {
		if (Array.isArray(this.messages) && !(this.messages as RPCMessageType[]).find(i => i.method === message.method)) {
			throw new Error(`Register called on wrong feature.`);

		} else if ((this.messages as RPCMessageType).method !== message.method) {
			throw new Error(`Register called on wrong feature. Requested ${message.method} but reached feature ${(this.messages as RPCMessageType).method}`);
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

class ConnectionFeature extends SqlOpsFeature<undefined> {

	private static readonly messagesTypes: RPCMessageType[] = [
		ConnectionRequest.type,
		ConnectionCompleteNotification.type,
		ConnectionChangedNotification.type,
		DisconnectRequest.type,
		CancelConnectRequest.type,
		ChangeDatabaseRequest.type,
		ListDatabasesRequest.type,
		LanguageFlavorChangedNotification.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, ConnectionFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		ensure(ensure(capabilities, 'connection')!, 'connection')!.dynamicRegistration = true;
	}

	public initialize(capabilities: ServerCapabilities): void {
		throw new Error("Method not implemented.");
	}

	protected registerProvider(options: undefined): Disposable {
		let client = this._client;
	}
}

/**
 *
 */
export class SqlOpsDataClient extends LanguageClient {

	public constructor(name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
	public constructor(id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions, forceDebug?: boolean);
	public constructor(arg1: string, arg2: ServerOptions | string, arg3: LanguageClientOptions | ServerOptions, arg4?: boolean | LanguageClientOptions, arg5?: boolean) {
		if (typeof arg2 === 'string') {
			super(arg1, arg2, arg3 as ServerOptions, arg4 as LanguageClientOptions, arg5);
		} else {
			super(arg1, arg2 as ServerOptions, arg3 as LanguageClientOptions, arg4 as boolean);
		}
		this.registerDataFeatures();
	}

	private registerDataFeatures() {

	}
}
