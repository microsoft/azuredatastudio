/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import type * as azdata from 'azdata';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';

export class ExecutionPlanService implements IExecutionPlanService {
	private _providers: { [handle: string]: azdata.ExecutionPlanServiceProvider; } = Object.create(null);

	constructor(
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IQuickInputService private _quickInputService: IQuickInputService,
	) {
	}

	private _runAction<T>(fileFormat: string, action: (handler: azdata.ExecutionPlanServiceProvider) => Thenable<T>): Promise<T> {
		const providers = Object.keys(this._capabilitiesService.providers);

		let rightProviders: string[] = [];
		for (let i = 0; i < providers.length; i++) {
			const providerCapabilities = this._capabilitiesService.getCapabilities(providers[i]);
			if (providerCapabilities.connection.supportedExecutionPlanFileExtensions?.includes(fileFormat)) {
				rightProviders.push(providers[i]);
			}
		}

		let selectedProvider: string;
		if (rightProviders.length > 1) {
			const providerQuickPick = this._quickInputService.createQuickPick<IQuickPickItem>();
			providerQuickPick.items = rightProviders.map(p => {
				return {
					label: p,
					ariaLabel: p
				};
			});
			providerQuickPick.placeholder = localize('selectExecutionPlanServiceProvider', "Select a provider to open execution plan");
			providerQuickPick.onDidChangeValue(e => {
				selectedProvider = e;
			});
			providerQuickPick.show();
		} else {
			selectedProvider = rightProviders[0];
		}


		if (!selectedProvider) {
			return Promise.reject(new Error(localize('providerIdNotValidError', "Valid provider is required in order to interact with ExecutionPlanService")));
		}
		let handler = this._providers[selectedProvider];
		if (handler) {
			return Promise.resolve(action(handler));
		} else {
			return Promise.reject(new Error(localize('noHandlerRegistered', "No Handler Registered")));
		}
	}

	registerProvider(providerId: string, provider: azdata.ExecutionPlanServiceProvider): void {
		this._providers[providerId] = provider;
	}

	getExecutionPlan(planFile: azdata.ExecutionPlanGraphFile): Thenable<azdata.GetExecutionPlanResult> {
		return this._runAction(planFile.graphFileType, (runner) => {
			return runner.getExecutionPlan(planFile);
		});
	}

	getSupportedExecutionPlanExtensionsForProvider(providerId: string): string[] | undefined {
		return this._capabilitiesService.getCapabilities(providerId).connection.supportedExecutionPlanFileExtensions;
	}

	_serviceBrand: undefined;
}
