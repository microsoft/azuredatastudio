/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';

class ValueProviderService {
	private _valueProviderStore = new Map<string, rd.IValueProvider>();
	registerValueProvider(provider: rd.IValueProvider): void {
		if (this._valueProviderStore.has(provider.providerId)) {
			throw new Error(loc.valueProviderAlreadyDefined(provider.providerId));
		}
		this._valueProviderStore.set(provider.providerId, provider);
	}

	getValueProvider(providerId: string): rd.IValueProvider {
		const valueProvider = this._valueProviderStore.get(providerId);
		if (valueProvider === undefined) {
			throw new Error(loc.noValueProviderDefined(providerId));
		}
		return valueProvider;
	}
}

export const valueProviderService = new ValueProviderService();
