/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ICapabilitiesService, ProviderFeatures } from 'sql/platform/capabilities/common/capabilitiesService';
import { Disposable, IDisposable, combinedDisposable, dispose, toDisposable } from 'vs/base/common/lifecycle';
import { entries } from 'sql/base/common/collections';
import { Event, Emitter } from 'vs/base/common/event';
import { Deferred } from 'sql/base/common/promise';
import { assertType } from 'vs/base/common/types';

export const IConnectionService = createDecorator<IConnectionService>('connectionService');

/**
 * Event that we get from the provider for a connection having completed
 */
export interface IProviderConnectionCompleteEvent {
	connectionUri: string;
	errorMessage?: string;
}

/**
 * Event we get from the provider for a connection having changed
 */
export interface IProviderConnectionChangedEvent {
	connectionUri: string;
}

/**
 * Value a @IConnection will return when asked to connect
 */
export interface IConnectionCompleteEvent {
	errorMessage?: string;
	failed: boolean;
}

/**
 * The profile used to create a connection through the @IConnectionService
 */
export interface IConnectionProfile {
	provider: string;
	options: { [name: string]: any };
}

export type SerializableType = string | number | boolean | null | ISerializableObject;

export interface ISerializableObject {
	[key: string]: SerializableType | SerializableType[];
}

export interface IConnectionProvider {
	readonly id: string;
	connect(connectionUri: string, options: ISerializableObject): Promise<boolean>;
	disconnect(connectionUri: string): Promise<boolean>;
	cancelConnect(connectionUri: string): Promise<boolean>;
	readonly onDidConnectionComplete: Event<IProviderConnectionCompleteEvent>;
	readonly onDidConnectionChanged: Event<IProviderConnectionChangedEvent>;
}

export interface IConnectionService {
	_serviceBrand: undefined;
	registerProvider(provider: IConnectionProvider): IDisposable;
	/**
	 * Creates a connection with the given uri and profile
	 * If a connection already exists with the given uri A NEW ONE WILL NOT BE CREATED, the existing connection is returned.
	 * In the future we shouldn't allow the caller to pass in a id (uri) and instead split this into 2 different methods;
	 * one for creating and one for getting an existing
	 * @param connectionUri the uri to identify the connection with SHOULD BE REMOVED LETS USE GENERATED GUIDs
	 * @param profile
	 */
	createOrGetConnection(connectionUri: string, profile: IConnectionProfile): IConnection;
	/**
	 * Gets the underlying id for a connection from createOrGetConnection.
	 * Should only be called at the last possible moment, DO NOT PASS AROUND IDS, pass around connections
	 * @param connection
	 */
	getIdForConnection(connection: IConnection): string;
}

export enum ConnectionState {
	DISCONNECTED,
	CONNECTED,
	CONNECTING
}

export interface IConnection {
	/**
	 * Current state of the connection
	 */
	readonly state: ConnectionState;
	/**
	 * Event fired when the state changes on the connect with the current state
	 */
	readonly onDidStateChange: Event<ConnectionState>;
	/**
	 * Attmempt to connect this connection. This can only be called while the connection is in @type {ConnectionState.Disconnected}
	 * otherwise this function will throw. Check @this.state if you are unsure if this connection has already been connected
	 */
	connect(): Promise<IConnectionCompleteEvent>;
	/**
	 * Attempt to disconnect the current connection. If it is not connected will throw
	 */
	disconnect(): Promise<void>;
	/**
	 * A helper for subscribing to the next time this connection finishes connecting (success or failure).
	 * Only valid if @this.state is @type {ConnectionState.CONNECTING}
	 */
	readonly onDidConnect: Promise<IConnectionCompleteEvent>;
	/**
	 * The provider for this connection
	 */
	readonly provider: string;
}

class Connection extends Disposable implements IConnection {

	private readonly _onDidStateChange = this._register(new Emitter<ConnectionState>());
	public readonly onDidStateChange = this._onDidStateChange.event;

	private _lazyConnect?: Deferred<IConnectionCompleteEvent>;

	private _state: ConnectionState = ConnectionState.DISCONNECTED;

	public get onDidConnect(): Promise<IConnectionCompleteEvent> | undefined {
		return this._lazyConnect?.promise;
	}

	public get provider(): string { return this.profile.provider; }

	constructor(
		public readonly connectionId: string,
		public readonly profile: IConnectionProfile,
		public readonly connectionService: ConnectionService
	) {
		super();
	}

	public get state(): ConnectionState {
		return this._state;
	}

	private setState(state: ConnectionState): void {
		if (state !== this.state) {
			this._state = state;
			this._onDidStateChange.fire(this.state);
		}
	}

	public connectionCompleted(event: IProviderConnectionCompleteEvent): void {
		if (!this._lazyConnect) {
			throw new Error('Attempted to completed a connection that was not connecting');
		}
		if (event.errorMessage) {
			this.setState(ConnectionState.DISCONNECTED);
		} else {
			this.setState(ConnectionState.CONNECTED);
		}
		this._lazyConnect.resolve({ failed: !!event.errorMessage, errorMessage: event.errorMessage });
	}

	public async connect(): Promise<IConnectionCompleteEvent> {
		switch (this.state) {
			case ConnectionState.CONNECTED:
			case ConnectionState.CONNECTING:
				return this.onDidConnect; // intentional fall through
			case ConnectionState.DISCONNECTED:
				if (this._lazyConnect) {
					this._lazyConnect = undefined;
				}
				this.setState(ConnectionState.CONNECTING);
				this._lazyConnect = new Deferred<IConnectionCompleteEvent>();
				const didStart = await this.connectionService.connect(this.connectionId, this.profile);
				if (!didStart) { // quick resolution here if we didn't even start to connect
					this._lazyConnect.resolve({ failed: true });
					this.setState(ConnectionState.DISCONNECTED);
				}
				return this._lazyConnect.promise;
			default:
				throw new Error('Connection not disconnected'); // not sure what to do here; callers should really check state first
		}
	}

	public async disconnect(): Promise<void> {
		if (this.state !== ConnectionState.CONNECTED) {
			throw new Error('Connection is not connected');
		}

		await this.connectionService.disconnect(this.connectionId, this.profile); // should we be checking this return value?

		this.setState(ConnectionState.DISCONNECTED);
	}
}

export class ConnectionService extends Disposable implements IConnectionService {
	_serviceBrand: undefined;

	private readonly knownProviders = new Set<string>(); // providers we know to exist but might not have registed yet
	private readonly connectionProviders = new Map<string, { provider: Deferred<IConnectionProvider>, disposable?: IDisposable }>(); // providers that have been registered
	private readonly connections = new Map<string, Connection>();

	constructor(
		@ICapabilitiesService capabilitiesService: ICapabilitiesService
	) {
		super();
		for (const [id, provider] of entries(capabilitiesService.providers)) {
			this.tryAddKnownProvider(id, provider);
		}
		this._register(capabilitiesService.onCapabilitiesRegistered(e => this.tryAddKnownProvider(e.id, e.features)));
		this._register(capabilitiesService.onCapabilitiesUnregistered(e => {
			if (this.knownProviders.delete(e)) { // only bother deleting the provider if it is a known provider
				dispose(this.connectionProviders.get(e)!.disposable); // we delete as part of the disposable
			}
		}));
	}

	public getIdForConnection(connection: IConnection): string {
		assertType(connection instanceof Connection, 'Connection');
		return connection.connectionId;
	}

	private tryAddKnownProvider(id: string, provider: ProviderFeatures) {
		if (provider.connection) { // does this provider provider connection capabilities kinda unnecessary at this point but a good future proof
			this.knownProviders.add(id);
			this.connectionProviders.set(id, { provider: new Deferred<IConnectionProvider>() });
		}
	}

	public registerProvider(provider: IConnectionProvider): IDisposable {
		if (!this.knownProviders.has(provider.id)) {
			throw new Error(`Unknown provider registered: ${provider.id}`);
		}
		const disposable = combinedDisposable(
			provider.onDidConnectionChanged(e => this.onConnectionChanged(e)),
			provider.onDidConnectionComplete(e => this.onConnectionComplete(e)),
			toDisposable(() => this.connectionProviders.delete(provider.id))
		);
		const providerStub = this.connectionProviders.get(provider.id);
		providerStub.disposable = disposable;
		providerStub.provider.resolve(provider);
		return disposable;
	}

	private onConnectionChanged(event: IProviderConnectionChangedEvent): void {
		// this._onDidConnectionChange.fire(event);
	}

	private onConnectionComplete(event: IProviderConnectionCompleteEvent): void {
		const connection = this.connections.get(event.connectionUri);
		if (connection) {
			connection.connectionCompleted(event);
		} else {
			throw new Error('Received connection complete event for non-existed connection');
		}
	}

	public createOrGetConnection(connectionId: string, profile: IConnectionProfile): IConnection {
		if (this.connections.has(connectionId)) {
			return this.connections.get(connectionId);
		}
		if (!this.connectionProviders.has(profile.provider)) {
			throw new Error(`Provider could not be found: ${profile.provider}`);
		}
		const connection = new Connection(connectionId, profile, this);
		this.connections.set(connectionId, connection);
		return connection;
	}

	//#region @type{Query} helpers
	public async connect(connectionId: string, profile: IConnectionProfile): Promise<boolean> {
		return (await this.withProvider(profile.provider)).connect(connectionId, profile.options);
	}

	public async disconnect(connectionId: string, profile: IConnectionProfile): Promise<boolean> {
		return (await this.withProvider(profile.provider)).disconnect(connectionId);
	}
	//#endregion

	private withProvider(provider: string): Promise<IConnectionProvider> {
		const providerStub = this.connectionProviders.get(provider);
		if (!providerStub) {
			throw new Error(`Connection provider could not be found: ${provider}`);
		}
		return providerStub.provider;
	}
}

registerSingleton(IConnectionService, ConnectionService, true);
