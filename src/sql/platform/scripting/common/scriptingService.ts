/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ScriptOperation } from 'sql/workbench/common/taskUtilities';
import * as sqlops from 'sqlops';
import { error } from 'sql/base/common/log';
export const SERVICE_ID = 'scriptingService';

export const IScriptingService = createDecorator<IScriptingService>(SERVICE_ID);

export interface IScriptingService {
	_serviceBrand: any;

	script(connectionUri: string, metadata: sqlops.ObjectMetadata, operation: ScriptOperation, paramDetails: sqlops.ScriptingParamDetails): Thenable<sqlops.ScriptingResult>;

	/**
	 * Register a scripting provider
	 */
	registerProvider(providerId: string, provider: sqlops.ScriptingProvider): void;

	/**
	 * Specifies whether a provider with a given ID has been registered or not
	 */
	isProviderRegistered(providerId: string): boolean;

	/**
	 * Callback method for when scripting is complete
	 */
	onScriptingComplete(handle: number, scriptingCompleteResult: sqlops.ScriptingCompleteResult): void;

	/**
	 * Returns the result for an operation if the operation failed
	 */
	getOperationFailedResult(operationId: string): sqlops.ScriptingCompleteResult;
}

export class ScriptingService implements IScriptingService {

	public _serviceBrand: any;

	private disposables: IDisposable[] = [];

	private _providers: { [handle: string]: sqlops.ScriptingProvider; } = Object.create(null);

	private failedScriptingOperations: { [operationId: string]: sqlops.ScriptingCompleteResult } = {};
	constructor( @IConnectionManagementService private _connectionService: IConnectionManagementService) { }

	/**
	 * Call the service for scripting based on provider and scripting operation
	 * @param connectionUri
	 * @param metadata
	 * @param operation
	 * @param paramDetails
	 */
	public script(connectionUri: string, metadata: sqlops.ObjectMetadata, operation: ScriptOperation, paramDetails: sqlops.ScriptingParamDetails): Thenable<sqlops.ScriptingResult> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);

		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.scriptAsOperation(connectionUri, operation, metadata, paramDetails);
			}
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Callback method for when scripting is complete
	 * @param handle
	 * @param scriptingCompleteResult
	 */
	public onScriptingComplete(handle: number, scriptingCompleteResult: sqlops.ScriptingCompleteResult): void {
		if (scriptingCompleteResult && scriptingCompleteResult.hasError && scriptingCompleteResult.errorMessage) {
			error(`Scripting failed. error: ${scriptingCompleteResult.errorMessage}`);
			if (scriptingCompleteResult.operationId) {
				this.failedScriptingOperations[scriptingCompleteResult.operationId] = scriptingCompleteResult;
			}
		}
	}

	/**
	 * Returns the result for an operation if the operation failed
	 * @param operationId Operation Id
	 */
	public getOperationFailedResult(operationId: string): sqlops.ScriptingCompleteResult {
		if (operationId && operationId in this.failedScriptingOperations) {
			return this.failedScriptingOperations[operationId];
		} else {
			return undefined;
		}
	}

	/**
	 * Register a scripting provider
	 */
	public registerProvider(providerId: string, provider: sqlops.ScriptingProvider): void {
		this._providers[providerId] = provider;
	}

	public isProviderRegistered(providerId: string): boolean {
		let provider = this._providers[providerId];
		return !!provider;
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
