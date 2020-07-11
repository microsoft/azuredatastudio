/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as utils from '../../../common/utils';

/**
* Wizard to register a model
*/
export class ModelArtifact {

	/**
	 * Creates new model artifact
	 */
	constructor(private _filePath: string, private _deleteAtClose: boolean = true) {
	}

	public get filePath(): string {
		return this._filePath;
	}

	/**
	 * Closes the artifact and disposes the resources
	 */
	public async close(): Promise<void> {
		if (this._deleteAtClose) {
			try {
				await utils.deleteFile(this._filePath);
			} catch {

			}
		}
	}
}
