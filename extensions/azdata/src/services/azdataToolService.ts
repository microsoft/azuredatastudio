/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzdataTool } from '../azdata';

export class AzdataToolService {
	private _localAzdata: IAzdataTool | undefined;
	constructor() {
	}

	/**
	* Gets the localAzdata that was last saved
	*/
	get localAzdata(): IAzdataTool | undefined {
		return this._localAzdata;
	}

	/**
	* Sets the localAzdata that was last saved
	*
	* @param memento The memento that stores the localAzdata object
	*/
	set localAzdata(azdata: IAzdataTool | undefined) {
		this._localAzdata = azdata;
	}
}

