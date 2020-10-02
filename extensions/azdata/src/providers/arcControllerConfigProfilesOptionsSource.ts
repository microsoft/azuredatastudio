/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import { IAzdataTool } from '../azdata';

/**
 * Class that provides options sources for an Arc Data Controller
 */
export class ArcControllerConfigProfilesOptionsSource implements rd.IOptionsSourceProvider {
	readonly optionsSourceId = 'arc.controller.config.profiles';
	constructor(private _azdata: IAzdataTool) { }
	async getOptions(): Promise<string[]> {
		return (await this._azdata.arc.dc.config.list()).result;
	}
}
