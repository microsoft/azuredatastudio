/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ICapabilitiesService, ProviderFeatures } from 'sql/platform/capabilities/common/capabilitiesService';
import { Disposable, IDisposable, combinedDisposable, dispose } from 'vs/base/common/lifecycle';
import { entries } from 'sql/base/common/collections';
import { Event, Emitter } from 'vs/base/common/event';
import { Deferred } from 'sql/base/common/promise';
import { ILogService } from 'vs/platform/log/common/log';

export const IConnectionService = createDecorator<IConnectionService>('connectionService');

export interface IConnectionCompleteEvent {
	connectionUri: string;
	errorMessage?: string;
}

export interface IConnectionChangedEvent {
	connectionUri: string;
}

export interface IConnectProfile {
	provider: string;
	options: { [name: string]: any };
}

export interface IConnectionProvider {
	readonly id: string;
	connect(connectionUri: string, options: { [name: string]: any }): Promise<boolean>;
	disconnect(connectionUri: string): Promise<boolean>;
	cancelConnect(connectionUri: string): Promise<boolean>;
	readonly onDidConnectionComplete: Event<IConnectionCompleteEvent>;
	readonly onDidConnectionChanged: Event<IConnectionChangedEvent>;
}

export interface IConnectionService {
	_serviceBrand: undefined;
	connect(connectionUri: string, profile: IConnectProfile): Promise<IConnectionCompleteEvent>;
	registerProvider(provider: IConnectionProvider);
}

class ConnectionService extends Disposable implements IConnectionService {
	_serviceBrand: undefined;

	private readonly knownProviders = new Set<string>(); // providers we know to exist but might not have registed yet
	private readonly connectionProviders = new Map<string, { provider: Deferred<IConnectionProvider>, disposable?: IDisposable }>(); // providers that have been registered
	private readonly runningConnections = new Map<string, Deferred<IConnectionCompleteEvent>>();
	private readonly _onDidConnectionChange = this._register(new Emitter<IConnectionChangedEvent>());
	public readonly onDidConnectionChange = this._onDidConnectionChange.event;

	constructor(
		@ICapabilitiesService capabilitiesService: ICapabilitiesService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		for (const [id, provider] of entries(capabilitiesService.providers)) {
			this.tryAddKnownProvider(id, provider);
		}
		this._register(capabilitiesService.onCapabilitiesRegistered(e => this.tryAddKnownProvider(e.id, e.features)));
		this._register(capabilitiesService.onCapabilitiesUnregistered(e => {
			if (this.knownProviders.delete(e)) { // only bother deleting the provider if it is a known provider
				dispose(this.connectionProviders.get(e)!.disposable);
				this.connectionProviders.delete(e);
			}
		}));
	}

	private tryAddKnownProvider(id: string, provider: ProviderFeatures) {
		if (provider.connection) { // does this provider provider connection capabilities kinda unnecessary at this point but a good future proof
			this.knownProviders.add(id);
			this.connectionProviders.set(id, { provider: new Deferred<IConnectionProvider>() });
		}
	}

	registerProvider(provider: IConnectionProvider): void {
		if (!this.knownProviders.has(provider.id)) {
			throw new Error(`Unknown provider registered: ${provider.id}`);
		}
		const disposable = combinedDisposable(
			provider.onDidConnectionChanged(e => this.onConnectionChanged(e)),
			provider.onDidConnectionComplete(e => this.onConnectionComplete(e))
		);
		const providerStub = this.connectionProviders.get(provider.id);
		providerStub.disposable = disposable;
		providerStub.provider.resolve(provider);
	}

	private onConnectionChanged(event: IConnectionChangedEvent): void {
		this._onDidConnectionChange.fire(event);
	}

	private onConnectionComplete(event: IConnectionCompleteEvent): void {
		const promise = this.runningConnections.get(event.connectionUri);
		if (promise) {
			this.runningConnections.delete(event.connectionUri); // ensure we don't hold onto the promise
			promise.resolve(event);
		} else {
			this.logService.warn('Received connection complete event for non-existed connection');
		}
	}

	async connect(connectionUri: string, profile: IConnectProfile): Promise<IConnectionCompleteEvent> {
		const deferred = new Deferred<IConnectionCompleteEvent>();
		if (this.runningConnections.has(connectionUri)) {
			throw new Error(`Uri already connection: ${connectionUri}`);
		}
		const providerStub = this.connectionProviders.get(profile.provider);
		if (!providerStub) {
			throw new Error(`Provider could not be found: ${profile.provider}`);
		}
		const provider = await providerStub.provider;
		const didConnect = await provider.connect(connectionUri, profile.options);
		if (!didConnect) {
			throw new Error(`Failed to send connection request`);
		}
		this.runningConnections.set(connectionUri, deferred);
		return deferred.promise;
	}
}

registerSingleton(IConnectionService, ConnectionService, true);
