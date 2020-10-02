/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';

export class OptionsSources {
	private static _optionsSourceStore = new Map<string, rd.IOptionsSourceProvider>();
	static registerOptionsSourceProvider(provider: rd.IOptionsSourceProvider): void {
		if (OptionsSources._optionsSourceStore.has(provider.optionsSourceId)) {
			throw new Error(loc.optionsSourceAlreadyDefined(provider.optionsSourceId));
		}
		OptionsSources._optionsSourceStore.set(provider.optionsSourceId, provider);
	}

	static getOptionsSource(optionsSourceProviderId: string): rd.IOptionsSourceProvider {
		const optionsSource = OptionsSources._optionsSourceStore.get(optionsSourceProviderId);
		if (optionsSource === undefined) {
			throw new Error(loc.noOptionsSourceDefined(optionsSourceProviderId));
		}
		return optionsSource;
	}
}
