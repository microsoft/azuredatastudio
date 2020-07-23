/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';
import { QuickInput } from '../quickinput';
import { Editors } from '../editors';

export class Notebook {

	constructor(private code: Code, private quickAccess: QuickAccess, private quickInput: QuickInput, private editors: Editors) {
	}

	async openFile(fileName: string): Promise<void> {
		await this.quickAccess.openQuickAccess(fileName);

		await this.quickInput.waitForQuickInputElements(names => names[0] === fileName);
		await this.code.dispatchKeybinding('enter');
		await this.editors.waitForActiveTab(fileName);
		await this.code.waitForElement('.notebookEditor');
	}
}
