/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzTool } from '../az';

export class AzToolService {
	private _localAz: IAzTool | undefined;
	constructor() {
	}

	/**
	* Gets the localAz that was last saved
	*/
	get localAz(): IAzTool | undefined {
		return this._localAz;
	}

	/**
	* Sets the localAz object to be used for az operations
	*/
	set localAz(az: IAzTool | undefined) {
		this._localAz = az;
	}
}
