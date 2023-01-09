/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import {
	ExtHostErrorDiagnosticsShape,
	MainThreadErrorDiagnosticsShape,
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { values } from 'vs/base/common/collections';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

export class ExtHostErrorDiagnostics extends ExtHostErrorDiagnosticsShape {
	private _handlePool: number = 0;
	private _proxy: MainThreadErrorDiagnosticsShape;
	private _providers: { [handle: number]: DiagnosticsWithMetadata } = {};

	constructor(mainContext: IMainContext) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadErrorDiagnostics);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	// - MAIN THREAD AVAILABLE METHODS /////////////////////////////////////
	public override $handleErrorCode(handle: number, errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.diagnostics.ErrorCodes> {
		return this._withProvider(handle, (provider: azdata.Diagnostics) => provider.handleErrorCode(errorCode, errorMessage, connectionTypeId));
	}

	// - EXTENSION HOST AVAILABLE METHODS //////////////////////////////////
	public $registerDiagnostics(providerMetadata: azdata.ResourceProviderMetadata, diagnostics: azdata.Diagnostics): Disposable {
		let self = this;

		// Look for any account providers that have the same provider ID
		let matchingProviderIndex = values(this._providers).findIndex((provider: DiagnosticsWithMetadata) => {
			return provider.metadata.id === providerMetadata.id;
		});
		if (matchingProviderIndex >= 0) {
			throw new Error(`Resource Provider with ID '${providerMetadata.id}' has already been registered`);
		}

		// Create the handle for the provider
		let handle: number = this._nextHandle();
		this._providers[handle] = {
			metadata: providerMetadata,
			provider: diagnostics
		};

		// Register the provider in the main thread via the proxy
		this._proxy.$registerDiagnostics(providerMetadata, handle);

		// Return a disposable to cleanup the provider
		return new Disposable(() => {
			delete self._providers[handle];
			self._proxy.$unregisterDiagnostics(handle);
		});
	}

	/**
	 * This method is for testing only, it is not exposed via the shape.
	 * @return Number of providers that are currently registered
	 */
	public getProviderCount(): number {
		return Object.keys(this._providers).length;
	}

	// PRIVATE METHODS /////////////////////////////////////////////////////
	private _nextHandle(): number {
		return this._handlePool++;
	}

	private _withProvider<R>(handle: number, callback: (provider: azdata.Diagnostics) => Thenable<R>): Thenable<R> {
		let provider = this._providers[handle];
		if (provider === undefined) {
			return Promise.reject(new Error(`Provider ${handle} not found.`));
		}
		return callback(provider.provider);
	}
}

interface DiagnosticsWithMetadata {
	metadata: azdata.ResourceProviderMetadata;
	provider: azdata.Diagnostics;
}
