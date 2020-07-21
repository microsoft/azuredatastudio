/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { executeCommand } from '../../common/childProcess';

describe('ChildProcess', function () {
	[undefined, [], ['test']].forEach(args => {
		it(`Output channel is used with ${JSON.stringify(args)} args`, async function (): Promise<void> {
			const outputChannelMock = TypeMoq.Mock.ofType<vscode.OutputChannel>();
			await executeCommand('echo', args, outputChannelMock.object);
			outputChannelMock.verify(x => x.appendLine(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});
	});

	it('Gets expected output', async function (): Promise<void> {
		const echoOutput = 'test';
		const output = await executeCommand('echo', [echoOutput]);
		should(output).equal(echoOutput);
	});

	it('Invalid command errors', async function (): Promise<void> {
		await should(executeCommand('sdfkslkf')).be.rejected();
	});
});
