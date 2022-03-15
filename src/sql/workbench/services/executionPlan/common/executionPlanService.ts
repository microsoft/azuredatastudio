/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import type * as azdata from 'azdata';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { Event, Emitter } from 'vs/base/common/event';

interface ExecutionPlanProviderRegisteredEvent {
	id: string,
	provider: azdata.executionPlan.ExecutionPlanServiceProvider
}
export class ExecutionPlanService implements IExecutionPlanService {
	private _providers: { [handle: string]: azdata.executionPlan.ExecutionPlanServiceProvider; } = Object.create(null);
	private _onProviderRegister: Emitter<ExecutionPlanProviderRegisteredEvent> = new Emitter<ExecutionPlanProviderRegisteredEvent>();
	private _providerRegisterEvent: Event<ExecutionPlanProviderRegisteredEvent>;
	constructor(
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@IExtensionService private _extensionService: IExtensionService
	) {
		this._providerRegisterEvent = this._onProviderRegister.event;
	}

	private async _runAction<T>(fileFormat: string, action: (handler: azdata.executionPlan.ExecutionPlanServiceProvider) => Thenable<T>): Promise<T> {
		let providers = Object.keys(this._capabilitiesService.providers);
		if (!providers) {
			providers = await new Promise(resolve => {
				this._capabilitiesService.onCapabilitiesRegistered(e => {
					resolve(Object.keys(this._capabilitiesService.providers));
				});
			});
		}

		let epProviders: string[] = [];
		for (let i = 0; i < providers.length; i++) {
			const providerCapabilities = this._capabilitiesService.getCapabilities(providers[i]);
			if (providerCapabilities.connection.supportedExecutionPlanFileExtensions?.includes(fileFormat)) {
				epProviders.push(providers[i]);
			}
		}

		let selectedProvider: string;
		if (epProviders.length > 1) {
			const providerQuickPick = this._quickInputService.createQuickPick<IQuickPickItem>();
			providerQuickPick.items = epProviders.map(p => {
				return {
					label: p,
					ariaLabel: p
				};
			});
			providerQuickPick.placeholder = localize('selectExecutionPlanServiceProvider', "Select a provider to open execution plan");

			selectedProvider = await new Promise((resolve) => {
				providerQuickPick.onDidChangeSelection(e => {
					providerQuickPick.hide();
					resolve(e[0].label);
				});
				providerQuickPick.show();
			});
		} else {
			selectedProvider = epProviders[0];
		}


		if (!selectedProvider) {
			return Promise.reject(new Error(localize('providerIdNotValidError', "Valid provider is required in order to interact with ExecutionPlanService")));
		}
		await this._extensionService.whenInstalledExtensionsRegistered();
		let handler = this._providers[selectedProvider];
		if (!handler) {
			handler = await new Promise((resolve, reject) => {
				this._providerRegisterEvent(e => {
					if (e.id === selectedProvider) {
						resolve(e.provider);
					}
				});
				setTimeout(() => {
					/**
					 * Handling a possible edge case where provider registered event
					 * might have been called before we await for it.
					 */
					if (this._providers[selectedProvider]) {
						resolve(this._providers[selectedProvider]);
						return;
					}
					resolve(undefined);
				}, 30000);
			});
		}
		if (handler) {
			return Promise.resolve(action(handler));
		} else {
			return Promise.reject(new Error(localize('noHandlerRegistered', "No valid execution plan handler is registered")));
		}
	}

	registerProvider(providerId: string, provider: azdata.executionPlan.ExecutionPlanServiceProvider): void {
		if (this._providers[providerId]) {
			throw new Error(`A execution plan provider with id "${providerId}" is already registered`);
		}
		this._providers[providerId] = provider;
		this._onProviderRegister.fire({
			id: providerId,
			provider: provider
		});
	}

	getExecutionPlan(planFile: azdata.executionPlan.ExecutionPlanGraphInfo): Promise<azdata.executionPlan.GetExecutionPlanResult> {
		return this._runAction(planFile.graphFileType, (runner) => {
			return runner.getExecutionPlan(planFile);
		});
	}

	getSupportedExecutionPlanExtensionsForProvider(providerId: string): string[] | undefined {
		return this._capabilitiesService.getCapabilities(providerId).connection.supportedExecutionPlanFileExtensions;
	}

	_serviceBrand: undefined;
}
