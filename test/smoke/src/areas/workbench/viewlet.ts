/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Code } from '../../vscode/code';

export abstract class Viewlet {

	constructor(protected code: Code) { }

	async waitForTitle(fn: (title: string) => boolean): Promise<void> {
		await this.code.waitForTextContent('.monaco-workbench-container .part.sidebar > .title > .title-label > span', undefined, fn);
	}
}