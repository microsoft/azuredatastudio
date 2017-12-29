import {
	LanguageClient, ServerOptions, LanguageClientOptions, DynamicFeature, ServerCapabilities, RegistrationData,
	RPCMessageType, Disposable
} from 'vscode-languageclient';

import { ClientCapabilities } from './protocol';

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

	constructor(protected _client: SqlOpsDataClient, private _message: RPCMessageType) {
	}

	public get messages(): RPCMessageType {
		return this._message;
	}

	public abstract fillClientCapabilities(capabilities: ClientCapabilities): void;

	public abstract initialize(capabilities: ServerCapabilities): void;

	register(message: RPCMessageType, data: RegistrationData<T>): void {
		if (message.method !== this.messages.method) {
			throw new Error(`Register called on wrong feature. Requested ${message.method} but reached feature ${this.messages.method}`);
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
	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		ensure(ensure(capabilities, 'connection')!, 'connection')!.dynamicRegistration = true;
	}
	public initialize(capabilities: ServerCapabilities): void {
		throw new Error("Method not implemented.");
	}
	protected registerProvider(options: undefined): Disposable {
		throw new Error("Method not implemented.");
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
