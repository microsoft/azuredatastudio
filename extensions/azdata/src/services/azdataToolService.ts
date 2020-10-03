/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzdataTool, IAzdataTool } from '../azdata';
import * as constants from '../constants';


export class AzdataToolService {
	private _localAzdata: IAzdataTool | undefined;
	constructor(private _memento: vscode.Memento) {
		this._localAzdata = this._memento.get<AzdataTool>(constants.localAzdata);
	}

	/**
	*	Gets the localAzdata that was last saved
	*
	* @param memento The memento that stores the localAzdata object
	*/
	get localAzdata(): IAzdataTool | undefined {
		return this._localAzdata;
	}

	/**
	*	Sets the localAzdata that was last saved
	*
	* @param memento The memento that stores the localAzdata object
	*/
	set localAzdata(azdata: IAzdataTool | undefined) {
		this._localAzdata = azdata;
		this._memento.update(constants.localAzdata, <AzdataTool>azdata);
	}
}

