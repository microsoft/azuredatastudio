/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';
import { Memento } from 'vscode';
import { throwIfNoAzdata } from '../api';
import { IAzdataTool, isEulaAccepted, promptForEula } from '../azdata';
import { AzdataToolService } from '../services/azdataToolService';


/**
 * Class that provides options sources for an Arc Data Controller
 */
export class ArcControllerConfigProfilesOptionsSource implements rd.IOptionsSourceProvider {
	readonly optionsSourceId = 'arc.controller.config.profiles';
	constructor(private _memento: Memento, private _azdataToolService: AzdataToolService, private _azdataDiscovered: Promise<IAzdataTool | undefined>) { }
	async getOptions(): Promise<string[]> {
		await this._azdataDiscovered;
		throwIfNoAzdata(this._azdataToolService.localAzdata);
		if (!isEulaAccepted(this._memento)) { // this is defense in depth, just ensuring that eula has been accepted before using azdata tool.
			promptForEula(this._memento, true /* userRequested */, true /* requireUserAction */);
		}
		return (await this._azdataToolService.localAzdata.arc.dc.config.list()).result;
	}
}
