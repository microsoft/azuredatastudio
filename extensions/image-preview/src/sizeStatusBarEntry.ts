/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { PreviewStatusBarEntry } from './ownedStatusBarEntry';

const localize = nls.loadMessageBundle();

export class SizeStatusBarEntry extends PreviewStatusBarEntry {

	constructor() {
		super('status.imagePreview.size', localize('sizeStatusBar.name', "Image Size"), vscode.StatusBarAlignment.Right, 101 /* to the left of editor status (100) */);
	}

	public show(owner: string, text: string) {
		this.showItem(owner, text);
	}
}
