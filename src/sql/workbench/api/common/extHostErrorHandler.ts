/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import {
	ExtHostErrorHandlerShape,
	MainThreadErrorHandlerShape,
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { values } from 'vs/base/common/collections';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

export class ExtHostErrorHandler extends ExtHostErrorHandlerShape {
	private _handlePool: number = 0;
	private _proxy: MainThreadErrorHandlerShape;
	private _providers: { [handle: number]: ErrorHandlerWithMetadata } = {};

	constructor(mainContext: IMainContext) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadErrorHandler);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	// - MAIN THREAD AVAILABLE METHODS /////////////////////////////////////
	public override $handleErrorCode(handle: number, errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.diagnostics.ErrorCodes> {
		return this._withProvider(handle, (provider: azdata.ErrorHandler) => provider.handleErrorCode(errorCode, errorMessage, connectionTypeId));
	}

	// - EXTENSION HOST AVAILABLE METHODS //////////////////////////////////
	public $registerErrorHandler(providerMetadata: azdata.ResourceProviderMetadata, provider: azdata.ErrorHandler): Disposable {
		let self = this;

		// Look for any account providers that have the same provider ID
		let matchingProviderIndex = values(this._providers).findIndex((provider: ErrorHandlerWithMetadata) => {
			return provider.metadata.id === providerMetadata.id;
		});
		if (matchingProviderIndex >= 0) {
			throw new Error(`Resource Provider with ID '${providerMetadata.id}' has already been registered`);
		}

		// Create the handle for the provider
		let handle: number = this._nextHandle();
		this._providers[handle] = {
			metadata: providerMetadata,
			provider: provider
		};

		// Register the provider in the main thread via the proxy
		this._proxy.$registerErrorHandler(providerMetadata, handle);

		// Return a disposable to cleanup the provider
		return new Disposable(() => {
			delete self._providers[handle];
			self._proxy.$unregisterErrorHandler(handle);
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

	private _withProvider<R>(handle: number, callback: (provider: azdata.ErrorHandler) => Thenable<R>): Thenable<R> {
		let provider = this._providers[handle];
		if (provider === undefined) {
			return Promise.reject(new Error(`Provider ${handle} not found.`));
		}
		return callback(provider.provider);
	}
}

interface ErrorHandlerWithMetadata {
	metadata: azdata.ResourceProviderMetadata;
	provider: azdata.ErrorHandler;
}
