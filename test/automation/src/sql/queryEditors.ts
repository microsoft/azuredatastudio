/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Editors } from '../editors';
import { Code } from '../code';

export class QueryEditors {

	constructor(
		private readonly code: Code,
		private readonly editors: Editors
	) {
	}

	async newUntitledQuery(): Promise<void> {
		if (process.platform === 'darwin') {
			await this.code.dispatchKeybinding('cmd+n');
		} else {
			await this.code.dispatchKeybinding('ctrl+n');
		}

		await this.editors.waitForEditorFocus('SQLQuery_1');
	}
}
