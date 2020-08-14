/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IDiagramService, DiagramRequestParams } from 'sql/workbench/services/diagrams/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { localize } from 'vs/nls';

export class DiagramService implements IDiagramService {
	_serviceBrand: undefined;

	private _providers: { [handle: string]: azdata.DiagramServicesProvider; } = Object.create(null);

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) { }

	private _runAction<T>(uri: string, action: (handler: azdata.DiagramServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return Promise.reject(new Error(localize('diagram.noProvider', "Connection is required in order to interact with service")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error(localize('diagram.noHandlerRegistered', "No Handler Registered")));
		}
	}

	public getDiagramModel(params: DiagramRequestParams): Thenable<azdata.DiagramRequestResult> {
		return this._runAction(params.ownerUri, (runner) => {
			return runner.getDiagramModel(params);
		});
	}

	public registerProvider(providerId: string, provider: azdata.DiagramServicesProvider): void {
		this._providers[providerId] = provider;
	}
}
