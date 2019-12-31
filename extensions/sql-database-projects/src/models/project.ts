/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class Project {
	public projectFile: vscode.Uri;

	constructor(projectFile: vscode.Uri) {
		this.projectFile = projectFile;
	}

	public async construct() {

	}
}
