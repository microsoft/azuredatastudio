/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import { OptionsSources } from './common/optionSources';

export function getExtensionApi(): rd.IExtension {
	return {
		registerOptionsSourceProvider: (provider: rd.IOptionsSourceProvider) => OptionsSources.registerOptionsSourceProvider(provider)
	};
}

