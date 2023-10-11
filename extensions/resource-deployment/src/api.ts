/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import { valueProviderService } from './services/valueProviderService';
import { optionsSourcesService } from './services/optionSourcesService';

export function getExtensionApi(): rd.IExtension {
	return {
		registerOptionsSourceProvider: (provider: rd.IOptionsSourceProvider) => optionsSourcesService.registerOptionsSourceProvider(provider),
		registerValueProvider: (provider: rd.IValueProvider) => valueProviderService.registerValueProvider(provider)
	};
}

