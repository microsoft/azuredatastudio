/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';

interface ValueProviderContribution {
	id: string;
}

class ValueProviderService {
	private _valueProviderStore = new Map<string, rd.IValueProvider>();
	registerValueProvider(provider: rd.IValueProvider): vscode.Disposable {
		if (this._valueProviderStore.has(provider.id)) {
			throw new Error(loc.valueProviderAlreadyDefined(provider.id));
		}
		this._valueProviderStore.set(provider.id, provider);
		return {
			dispose: () => this.unregisterValueProvider(provider.id)
		};
	}

	private unregisterValueProvider(providerId: string): void {
		this._valueProviderStore.delete(providerId);
	}

	async getValueProvider(providerId: string): Promise<rd.IValueProvider> {
		let valueProvider = this._valueProviderStore.get(providerId);
		if (valueProvider === undefined) {
			// We don't have the provider registered yet so try to find and activate the extension that contributes it
			const ext = vscode.extensions.all.find(extension => {
				return !!(extension.packageJSON.contributes?.resourceDeploymentValueProviders as ValueProviderContribution[])?.find(valueProvider => valueProvider.id === providerId);
			});
			if (ext) {
				await ext.activate();
			}
			valueProvider = this._valueProviderStore.get(providerId);
			// Still don't have it registered - is the extension not properly registering it?
			if (valueProvider === undefined) {
				throw new Error(loc.noValueProviderDefined(providerId));
			}
		}
		return valueProvider;
	}
}

export const valueProviderService = new ValueProviderService();
