/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	public override $handleConnectionError(handle: number, errorInfo: azdata.diagnostics.IErrorInformation, connection: azdata.connection.ConnectionProfile): Thenable<azdata.diagnostics.ConnectionDiagnosticsResult> {
		let provider = this._providers[handle];
		if (provider === undefined) {
			return Promise.resolve({ handled: false });
		}
		else {
			return provider.provider.handleConnectionError(errorInfo, connection);
		}
	}

	// - EXTENSION HOST AVAILABLE METHODS //////////////////////////////////
	public $registerDiagnosticsProvider(providerMetadata: azdata.diagnostics.ErrorDiagnosticsProviderMetadata, errorDiagnostics: azdata.diagnostics.ErrorDiagnosticsProvider): Disposable {
		let self = this;

		// Look for any diagnostic providers that have the same provider ID
		let matchingProviderIndex = values(this._providers).findIndex((provider: DiagnosticsWithMetadata) => {
			return provider.metadata.targetProviderId === providerMetadata.targetProviderId;
		});
		if (matchingProviderIndex >= 0) {
			throw new Error(`Diagnostics Provider with ID '${providerMetadata.targetProviderId}' has already been registered`);
		}

		// Create the handle for the provider
		let handle: number = this._nextHandle();
		this._providers[handle] = {
			metadata: providerMetadata,
			provider: errorDiagnostics
		};

		// Register the provider in the main thread via the proxy
		this._proxy.$registerDiagnosticsProvider(providerMetadata, handle);

		// Return a disposable to cleanup the provider
		return new Disposable(() => {
			delete self._providers[handle];
			self._proxy.$unregisterDiagnosticsProvider(handle);
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
}

interface DiagnosticsWithMetadata {
	metadata: azdata.diagnostics.ErrorDiagnosticsProviderMetadata;
	provider: azdata.diagnostics.ErrorDiagnosticsProvider;
}
