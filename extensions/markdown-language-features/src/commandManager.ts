/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface Command {
	readonly id: string;

	// {{SQL CARBON EDIT}}
	execute(...args: any[]): any;
}

export class CommandManager {
	private readonly commands = new Map<string, vscode.Disposable>();

	public dispose() {
		for (const registration of this.commands.values()) {
			registration.dispose();
		}
		this.commands.clear();
	}

	public register<T extends Command>(command: T): T {
		this.registerCommand(command.id, command.execute, command);
		return command;
	}

	// {{SQL CARBON EDIT}}
	private registerCommand(id: string, impl: (...args: any[]) => any, thisArg?: any) {
		if (this.commands.has(id)) {
			return;
		}

		this.commands.set(id, vscode.commands.registerCommand(id, impl, thisArg));
	}
}