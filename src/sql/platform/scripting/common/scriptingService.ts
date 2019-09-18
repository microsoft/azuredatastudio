/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as azdata from 'azdata';
import { ILogService } from 'vs/platform/log/common/log';

export const SERVICE_ID = 'scriptingService';

export const IScriptingService = createDecorator<IScriptingService>(SERVICE_ID);

export enum ScriptOperation {
	Select = 0,
	Create = 1,
	Insert = 2,
	Update = 3,
	Delete = 4,
	Execute = 5,
	Alter = 6
}

export interface IScriptingService {
	_serviceBrand: undefined;

	script(connectionUri: string, metadata: azdata.ObjectMetadata, operation: ScriptOperation, paramDetails: azdata.ScriptingParamDetails): Thenable<azdata.ScriptingResult | undefined>;

	/**
	 * Register a scripting provider
	 */
	registerProvider(providerId: string, provider: azdata.ScriptingProvider): void;

	/**
	 * Specifies whether a provider with a given ID has been registered or not
	 */
	isProviderRegistered(providerId: string): boolean;

	/**
	 * Callback method for when scripting is complete
	 */
	onScriptingComplete(handle: number, scriptingCompleteResult: azdata.ScriptingCompleteResult): void;

	/**
	 * Returns the result for an operation if the operation failed
	 */
	getOperationFailedResult(operationId: string): azdata.ScriptingCompleteResult | undefined;
}

export class ScriptingService implements IScriptingService {

	_serviceBrand: undefined;

	private _providers: { [handle: string]: azdata.ScriptingProvider; } = Object.create(null);

	private failedScriptingOperations: { [operationId: string]: azdata.ScriptingCompleteResult } = {};
	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ILogService private readonly logService: ILogService
	) { }

	/**
	 * Call the service for scripting based on provider and scripting operation
	 */
	public script(connectionUri: string, metadata: azdata.ObjectMetadata, operation: ScriptOperation, paramDetails: azdata.ScriptingParamDetails): Thenable<azdata.ScriptingResult | undefined> {
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
	 */
	public onScriptingComplete(handle: number, scriptingCompleteResult: azdata.ScriptingCompleteResult): void {
		if (scriptingCompleteResult && scriptingCompleteResult.hasError && scriptingCompleteResult.errorMessage) {
			this.logService.error(`Scripting failed. error: ${scriptingCompleteResult.errorMessage}`);
			if (scriptingCompleteResult.operationId) {
				this.failedScriptingOperations[scriptingCompleteResult.operationId] = scriptingCompleteResult;
			}
		}
	}

	/**
	 * Returns the result for an operation if the operation failed
	 * @param operationId Operation Id
	 */
	public getOperationFailedResult(operationId: string): azdata.ScriptingCompleteResult | undefined {
		if (operationId && operationId in this.failedScriptingOperations) {
			return this.failedScriptingOperations[operationId];
		} else {
			return undefined;
		}
	}

	/**
	 * Register a scripting provider
	 */
	public registerProvider(providerId: string, provider: azdata.ScriptingProvider): void {
		this._providers[providerId] = provider;
	}

	public isProviderRegistered(providerId: string): boolean {
		let provider = this._providers[providerId];
		return !!provider;
	}
}
