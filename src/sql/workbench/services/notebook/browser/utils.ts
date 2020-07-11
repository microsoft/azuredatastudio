/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function tryMatchCellMagic(input: string): string {
	if (!input) {
		return input;
	}
	let firstLine = input.trimLeft();
	let magicRegex = /^%%(\w+)/g;
	let match = magicRegex.exec(firstLine);
	let magicName = match && match[1];
	return magicName;
}

/**
 * When a cell is formatted in the following way, extract the commandId and args:
 * %%ads_execute_command commandId arg1 arg2
 * Extract the commandId and the two args
 * @param input cell source
 * @param magicName magic name
 */
export function extractCellMagicCommandPlusArgs(input: string, magicName: string): ICommandPlusArgs | undefined {
	if (input && magicName && input.startsWith(`%%${magicName}`)) {
		let commandNamePlusArgs = input.replace(`%%${magicName}`, '');
		if (commandNamePlusArgs?.startsWith(' ')) {
			// There needs to be a space between the magic name and the command id
			commandNamePlusArgs = commandNamePlusArgs.slice(1);
			let commandName = commandNamePlusArgs.split(' ')[0];
			if (commandName) {
				let args = commandNamePlusArgs.replace(commandName, '');
				if (args?.startsWith(' ')) {
					args = args.slice(1);
				}
				return {
					commandId: commandName,
					args: args
				};
			}
		}
	}
	return undefined;
}

export interface ICommandPlusArgs {
	commandId: string;
	args: string;
}
