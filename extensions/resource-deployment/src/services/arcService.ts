/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as arc from 'arc';
import * as vscode from 'vscode';

export class ArcService {
	private _arcApi: arc.IExtension;
	constructor() {
		this._arcApi = vscode.extensions.getExtension(arc.extension.name)?.exports;
	}

	public getAzureArcTreeDataProvider(): arc.IAzureArcTreeDataProvider {
		return this._arcApi.getAzureArcTreeDataProvider();
	}
}
