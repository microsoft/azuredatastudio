/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';

class DependentFieldProviderService {
	private _dependentFieldStore = new Map<string, rd.IDependentFieldProvider>();
	registerDependentFieldProvider(provider: rd.IDependentFieldProvider): void {
		if (this._dependentFieldStore.has(provider.providerId)) {
			throw new Error(loc.dependentFieldProviderAlreadyDefined(provider.providerId));
		}
		this._dependentFieldStore.set(provider.providerId, provider);
	}

	getDependentFieldProvider(providerId: string): rd.IDependentFieldProvider {
		const optionsSource = this._dependentFieldStore.get(providerId);
		if (optionsSource === undefined) {
			throw new Error(loc.noOptionsSourceDefined(providerId));
		}
		return optionsSource;
	}
}

export const dependentFieldProviderService = new DependentFieldProviderService();
