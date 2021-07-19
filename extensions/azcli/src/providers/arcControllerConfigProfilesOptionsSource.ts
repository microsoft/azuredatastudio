/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import * as azdataExt from 'azdata-ext';

/**
 * Class that provides options sources for an Arc Data Controller
 */
export class ArcControllerConfigProfilesOptionsSource implements rd.IOptionsSourceProvider {
	readonly id = 'arc.controller.config.profiles';
	constructor(private _azdataExtApi: azdataExt.IExtension) { }
	async getOptions(): Promise<string[]> {
		const isEulaAccepted = await this._azdataExtApi.isEulaAccepted();
		if (!isEulaAccepted) { // if eula has not yet be accepted then give user a chance to accept it
			await this._azdataExtApi.promptForEula();
		}
		return (await this._azdataExtApi.azdata.arc.dc.config.list()).result;
	}
}
