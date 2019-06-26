/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { SqlMainContext, MainThreadCredentialManagementShape, ExtHostCredentialManagementShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';

class CredentialAdapter {
	public provider: azdata.CredentialProvider;

	constructor(provider: azdata.CredentialProvider) {
		this.provider = provider;
	}

	public saveCredential(credentialId: string, password: string): Thenable<boolean> {
		return this.provider.saveCredential(credentialId, password);
	}

	public readCredential(credentialId: string): Thenable<azdata.Credential> {
		return this.provider.readCredential(credentialId);
	}

	public deleteCredential(credentialId: string): Thenable<boolean> {
		return this.provider.deleteCredential(credentialId);
	}
}

type Adapter = CredentialAdapter;

export class ExtHostCredentialManagement extends ExtHostCredentialManagementShape {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _adapter: { [handle: number]: Adapter } = Object.create(null);
	private _handlePool: number = 0;
	private _proxy: MainThreadCredentialManagementShape;
	private _registrationPromise: Promise<void>;
	private _registrationPromiseResolve;

	constructor(mainContext: IMainContext) {
		super();

		let self = this;

		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadCredentialManagement);

		// Create a promise to resolve when a credential provider has been registered.
		// HACK: this gives us a deferred promise
		this._registrationPromise = new Promise((resolve) => { self._registrationPromiseResolve = resolve; });
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public $registerCredentialProvider(provider: azdata.CredentialProvider): vscode.Disposable {
		// Store the credential provider
		provider.handle = this._nextHandle();
		this._adapter[provider.handle] = new CredentialAdapter(provider);

		// Register the credential provider with the main thread
		this._proxy.$registerCredentialProvider(provider.handle);

		// Resolve the credential provider registration promise
		this._registrationPromiseResolve();
		return this._createDisposable(provider.handle);
	}

	public $getCredentialProvider(namespaceId: string): Thenable<azdata.CredentialProvider> {
		let self = this;

		if (!namespaceId) {
			return Promise.reject(new Error('A namespace must be provided when retrieving a credential provider'));
		}

		// When the registration promise has finished successfully,
		return this._registrationPromise.then(() =>
			self._withAdapter(0, CredentialAdapter, adapter => self._createNamespacedCredentialProvider(namespaceId, adapter))
		);
	}

	public $saveCredential(credentialId: string, password: string): Thenable<boolean> {
		return this._withAdapter(0, CredentialAdapter, adapter => adapter.saveCredential(credentialId, password));
	}

	public $readCredential(credentialId: string): Thenable<azdata.Credential> {
		return this._withAdapter(0, CredentialAdapter, adapter => adapter.readCredential(credentialId));
	}

	public $deleteCredential(credentialId: string): Thenable<boolean> {
		return this._withAdapter(0, CredentialAdapter, adapter => adapter.deleteCredential(credentialId));
	}

	/**
	 * Helper method for tests. Not exposed via shape.
	 * @return Number of providers registered
	 */
	public getProviderCount(): number {
		return Object.keys(this._adapter).length;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private static _getNamespacedCredentialId(namespaceId: string, credentialId: string) {
		return `${namespaceId}|${credentialId}`;
	}

	private _createNamespacedCredentialProvider(namespaceId: string, adapter: CredentialAdapter): Thenable<azdata.CredentialProvider> {
		// Create a provider that wraps the methods in a namespace
		let provider: azdata.CredentialProvider = {
			handle: adapter.provider.handle,
			deleteCredential: (credentialId: string) => {
				let namespacedId = ExtHostCredentialManagement._getNamespacedCredentialId(namespaceId, credentialId);
				return adapter.provider.deleteCredential(namespacedId);
			},
			readCredential: (credentialId: string) => {
				let namespacedId = ExtHostCredentialManagement._getNamespacedCredentialId(namespaceId, credentialId);
				return adapter.provider.readCredential(namespacedId);
			},
			saveCredential: (credentialId: string, credential: string) => {
				let namespacedId = ExtHostCredentialManagement._getNamespacedCredentialId(namespaceId, credentialId);
				return adapter.provider.saveCredential(namespacedId, credential);
			}
		};
		return Promise.resolve(provider);
	}

	private _createDisposable(handle: number): Disposable {
		return new Disposable(() => {
			delete this._adapter[handle];
			this._proxy.$unregisterCredentialProvider(handle);
		});
	}

	private _nextHandle(): number {
		return this._handlePool++;
	}

	private _withAdapter<A, R>(handle: number, ctor: { new(...args: any[]): A }, callback: (adapter: A) => Thenable<R>): Thenable<R> {
		let adapter = this._adapter[handle];
		if (!(adapter instanceof ctor)) {
			return Promise.reject(new Error('no adapter found'));
		}
		return callback(<any>adapter);
	}
}
