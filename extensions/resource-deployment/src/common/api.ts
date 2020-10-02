/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import { OptionsSources } from './optionSources';

export function resourceDeploymentApi(): rd.IExtension {
	return {
		contributeOptionsSource: (provider: rd.IOptionsSourceProvider) => OptionsSources.contributeOptionsSource(provider)
	};
}

