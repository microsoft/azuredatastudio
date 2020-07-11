/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';

export class QueryEditor {

	public readonly commandBar: CommandBar;

	constructor(private code: Code) {
		this.commandBar = new CommandBar(code);
	}

	private static readonly RESULT_SELECTOR = '.query-editor-view .monaco-table';
	public async waitForResults(): Promise<void> {
		await this.code.waitForElement(QueryEditor.RESULT_SELECTOR);
	}
}

export class CommandBar {

	private static readonly COMMAND_BAR_BUTTON = '.query-editor .carbon-taskbar li .${CLASS}';

	constructor(private code: Code) { }

	public async run(): Promise<void> {
		await this.code.waitAndClick(CommandBar.COMMAND_BAR_BUTTON.replace('${CLASS}', 'start'));
	}

	public async connect(): Promise<void> {
		await this.code.waitAndClick(CommandBar.COMMAND_BAR_BUTTON.replace('${CLASS}', 'connect'));
	}
}
