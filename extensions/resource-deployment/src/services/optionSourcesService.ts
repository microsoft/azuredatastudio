/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';

class OptionsSourcesService {
	private _optionsSourceStore = new Map<string, rd.IOptionsSourceProvider>();
	registerOptionsSourceProvider(provider: rd.IOptionsSourceProvider): void {
		if (this._optionsSourceStore.has(provider.optionsSourceId)) {
			throw new Error(loc.optionsSourceAlreadyDefined(provider.optionsSourceId));
		}
		this._optionsSourceStore.set(provider.optionsSourceId, provider);
	}

	getOptionsSource(optionsSourceProviderId: string): rd.IOptionsSourceProvider {
		const optionsSource = this._optionsSourceStore.get(optionsSourceProviderId);
		if (optionsSource === undefined) {
			throw new Error(loc.noOptionsSourceDefined(optionsSourceProviderId));
		}
		return optionsSource;
	}
}

export const optionsSourcesService = new OptionsSourcesService();
