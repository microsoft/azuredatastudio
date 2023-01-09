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
	provider: azdata.executionPlan.ExecutionPlanProvider
}
export class ExecutionPlanService implements IExecutionPlanService {
	private _providers: { [handle: string]: azdata.executionPlan.ExecutionPlanProvider; } = Object.create(null);
	private _onProviderRegister: Emitter<ExecutionPlanProviderRegisteredEvent> = new Emitter<ExecutionPlanProviderRegisteredEvent>();
	private _providerRegisterEvent: Event<ExecutionPlanProviderRegisteredEvent>;
	constructor(
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@IExtensionService private _extensionService: IExtensionService
	) {
		this._providerRegisterEvent = this._onProviderRegister.event;
	}

	private async ensureCapabilitiesRegistered(): Promise<void> {
		let providers = Object.keys(this._capabilitiesService.providers);
		if (!providers) {
			await new Promise<void>(resolve => {
				this._capabilitiesService.onCapabilitiesRegistered(e => {
					resolve();
				});
			});
		}
	}

	private async getExecutionPlanProvider(providerId: string): Promise<azdata.executionPlan.ExecutionPlanProvider> {
		await this.ensureCapabilitiesRegistered();
		const provider = this._capabilitiesService.providers[providerId];
		// Return undefined if the provider is not registered or it is not a execution plan provider.
		if (!provider || !provider.connection?.isExecutionPlanProvider) {
			return undefined;
		}

		let handler = this._providers[providerId];
		if (handler) {
			return handler;
		}
		// Ensure the extension is loaded
		await this._extensionService.whenInstalledExtensionsRegistered();
		handler = this._providers[providerId];
		if (!handler) {
			handler = await new Promise((resolve, reject) => {
				this._providerRegisterEvent(e => {
					if (e.id === providerId) {
						resolve(e.provider);
					}
				});
				setTimeout(() => {
					/**
					 * Handling a possible edge case where provider registered event
					 * might have been called before we await for it.
					 */
					resolve(this._providers[providerId]);
				}, 30000);
			});
		}
		return handler;
	}

	/**
	 * Runs the actions using the provider that supports the fileFormat provided.
	 * @param fileFormat fileformat of the underlying execution plan file. It is used to get the provider that support it.
	 * @param action executionPlanService action to be performed.
	 */
	private async _runAction<T>(fileFormat: string, action: (handler: azdata.executionPlan.ExecutionPlanProvider) => Thenable<T>): Promise<T> {
		await this.ensureCapabilitiesRegistered();
		let providers = Object.keys(this._capabilitiesService.providers);
		let epProviders: string[] = [];
		for (let i = 0; i < providers.length; i++) {
			const providerCapabilities = this._capabilitiesService.getCapabilities(providers[i]);
			if (providerCapabilities.connection.supportedExecutionPlanFileExtensions?.includes(fileFormat)) {
				epProviders.push(providers[i]);
			}
		}

		let selectedProvider: string;

		/**
		 * This handles the case when multiple providers support the same execution plan extension.
		 * The code shows a quick pick and lets user select the provider they want to open the execution plan file with.
		 */
		if (epProviders.length > 1) {
			const providerQuickPick = this._quickInputService.createQuickPick<IQuickPickItem>();
			providerQuickPick.items = epProviders.map(p => {
				return {
					label: p,
					ariaLabel: p
				};
			});
			providerQuickPick.placeholder = localize('selectExecutionPlanProvider', "Select a provider to open execution plan");

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
		const handler = await this.getExecutionPlanProvider(selectedProvider);
		if (handler) {
			return Promise.resolve(action(handler));
		} else {
			return Promise.reject(new Error(localize('noHandlerRegistered', "No valid execution plan handler is registered")));
		}
	}

	registerProvider(providerId: string, provider: azdata.executionPlan.ExecutionPlanProvider): void {
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

	compareExecutionPlanGraph(firstPlanFile: azdata.executionPlan.ExecutionPlanGraphInfo, secondPlanFile: azdata.executionPlan.ExecutionPlanGraphInfo): Promise<azdata.executionPlan.ExecutionPlanComparisonResult> {
		return this._runAction(firstPlanFile.graphFileType, (runner) => {
			return runner.compareExecutionPlanGraph(firstPlanFile, secondPlanFile);
		});
	}

	async isExecutionPlan(providerId: string, value: string): Promise<azdata.executionPlan.IsExecutionPlanResult> {
		const handler = await this.getExecutionPlanProvider(providerId);
		if (handler) {
			return await handler.isExecutionPlan(value);
		} else {
			// If the provider is not an execution plan provider, then return false.
			return {
				isExecutionPlan: false,
				queryExecutionPlanFileExtension: ''
			};
		}
	}

	getSupportedExecutionPlanExtensionsForProvider(providerId: string): string[] | undefined {
		return this._capabilitiesService.getCapabilities(providerId).connection.supportedExecutionPlanFileExtensions;
	}

	getSupportedExecutionPlanExtensions(providerId: string): string[] | undefined {
		if (providerId) {
			return this._capabilitiesService.getCapabilities(providerId).connection.supportedExecutionPlanFileExtensions;
		} else {
			const supportedFileExtensionsSet: Set<string> = new Set();

			Object.keys(this._capabilitiesService.providers).forEach(v => {
				const extensions = this._capabilitiesService.getCapabilities(v).connection.supportedExecutionPlanFileExtensions;
				if (extensions) {
					extensions.forEach(ext => {
						supportedFileExtensionsSet.add(ext);
					});
				}
			});

			return [...supportedFileExtensionsSet];
		}
	}
	_serviceBrand: undefined;
}
