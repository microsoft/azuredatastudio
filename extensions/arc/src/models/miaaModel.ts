/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class MiaaModel {
	private readonly _onPasswordUpdated = new vscode.EventEmitter<string>();
	public onPasswordUpdated = this._onPasswordUpdated.event;
	public passwordLastUpdated?: Date;

	constructor(public connectionProfile: azdata.IConnectionProfile, private _name: string) {
	}

	/** Returns the service's name */
	public get name(): string {
		return this._name;
	}


	/** Refreshes the model */
	public async refresh() {
		await Promise.all([
		]);
	}
}
