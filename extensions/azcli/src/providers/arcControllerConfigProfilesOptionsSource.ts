/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as azExt from 'az-ext';

/**
 * Class that provides options sources for an Arc Data Controller
 */
export class ArcControllerConfigProfilesOptionsSource implements rd.IOptionsSourceProvider {
	readonly id = 'azcli.arc.controller.config.profiles';
	constructor(private _azExtApi: azExt.IExtension) { }
	async getOptions(): Promise<string[]> {
		return (await this._azExtApi.az.arcdata.dc.config.list()).stdout;
	}
}
