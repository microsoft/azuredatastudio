/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';

export class QueryEditor {

	public readonly commandBar: CommandBar;

	constructor(code: Code) {
		this.commandBar = new CommandBar(code);
	}

}

export class CommandBar {

	private static readonly COMMAND_BAR_BUTTON = '.query-editor .carbon-taskbar ul>:nth-child(${INDEX})';

	constructor(private code: Code) { }

	public async clickButton(index: number): Promise<void> {
		await this.code.waitAndClick(CommandBar.COMMAND_BAR_BUTTON.replace('${INDEX}', '' + index));
	}

	public async waitForButton(index: number, label: string): Promise<void> {
		await this.code.waitForTextContent(CommandBar.COMMAND_BAR_BUTTON.replace('${INDEX}', '' + index), label);
	}
}
