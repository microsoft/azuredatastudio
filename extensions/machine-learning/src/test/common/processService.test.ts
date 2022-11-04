/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ProcessService } from '../../common/processService';
import * as utils from '../../common/utils';
import should = require('should');

interface TestContext {

	outputChannel: vscode.OutputChannel;
}

function createContext(): TestContext {
	return {
		outputChannel: {
			name: '',
			append: () => { },
			appendLine: () => { },
			clear: () => { },
			show: () => { },
			hide: () => { },
			dispose: () => { },
			replace: () => { }
		}
	};
}

function execFolderListCommand(context: TestContext, service: ProcessService): Promise<string> {
	if (utils.isWindows()) {
		return service.execScripts('cmd', ['dir', '.'], [], context.outputChannel);
	} else {
		return service.execScripts('/bin/sh', ['ls'], [], context.outputChannel);
	}
}

function execGetCharacterCommand(context: TestContext, service: ProcessService): Promise<string> {
	if (utils.isWindows()) {
		return service.execScripts('cmd', ['set', '/p', 'asd="Hit enter"'], [], context.outputChannel);
	} else {
		return service.execScripts('/bin/sh', ['read'], [], context.outputChannel);
	}
}

function execFolderListBufferedCommand(context: TestContext, service: ProcessService): Promise<string> {
	if (utils.isWindows()) {
		return service.executeBufferedCommand('dir', context.outputChannel);
	} else {
		return service.executeBufferedCommand('ls', context.outputChannel);
	}
}

describe('Process Service', () => {
	it('execScripts should return successfully', async function (): Promise<void> {
		const context = createContext();
		let service = new ProcessService();
		await should(execFolderListCommand(context, service)).resolved();
	});

	it('execScripts should reject if command times out', async function (): Promise<void> {
		const context = createContext();
		let service = new ProcessService();
		service.timeout = 10;
		await should(execGetCharacterCommand(context, service)).rejected();
	});

	it('execScripts should resolve give valid script', async function (): Promise<void> {
		const context = createContext();
		let service = new ProcessService();
		service.timeout = 2000;
		await should(execFolderListBufferedCommand(context, service)).resolved();
	});

});
