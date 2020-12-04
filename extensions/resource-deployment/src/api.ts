/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import { dependentFieldProviderService } from './services/dependentFieldService';
import { optionsSourcesService } from './services/optionSourcesService';

export function getExtensionApi(): rd.IExtension {
	return {
		registerOptionsSourceProvider: (provider: rd.IOptionsSourceProvider) => optionsSourcesService.registerOptionsSourceProvider(provider),
		registerDependentFieldProvider: (provider: rd.IDependentFieldProvider) => dependentFieldProviderService.registerDependentFieldProvider(provider)
	};
}

