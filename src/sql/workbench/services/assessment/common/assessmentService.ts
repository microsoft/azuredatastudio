/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as azdata from 'azdata';
import { IAssessmentService } from 'sql/workbench/services/assessment/common/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

export class AssessmentService implements IAssessmentService {
	_serviceBrand: undefined;

	private _onDidChange = new Emitter<void>();
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private _providers: { [handle: string]: azdata.SqlAssessmentServicesProvider; } = Object.create(null);
	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) {

	}

	public getAssessmentItems(connectionUri: string, targetType: number): Thenable<azdata.SqlAssessmentResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.getAssessmentItems(connectionUri, targetType);
		});
	}

	public assessmentInvoke(connectionUri: string, targetType: number): Thenable<azdata.SqlAssessmentResult> {
		return this._runAction(connectionUri, (runner) => {
			return runner.assessmentInvoke(connectionUri, targetType);
		});
	}

	public generateAssessmentScript(connectionUri: string, items: azdata.SqlAssessmentResultItem[]): Thenable<azdata.ResultStatus> {
		return this._runAction(connectionUri, (runner) => {
			return runner.generateAssessmentScript(items);
		});
	}

	public registerProvider(providerId: string, provider: azdata.SqlAssessmentServicesProvider): void {
		this._providers[providerId] = provider;
	}

	private _runAction<T>(uri: string, action: (handler: azdata.SqlAssessmentServicesProvider) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return Promise.reject(new Error(localize('asmt.providerIdNotValidError', "Connection is required in order to interact with Assessment Service")));
		}
		let handler = this._providers[providerId];
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error(localize('asmt.noHandlerRegistered', "No Handler Registered")));
		}
	}
}
