/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sudo from 'sudo-prompt';
import * as sinon from 'sinon';
import Logger from '../../common/logger';

import { executeCommand, executeSudoCommand } from '../../common/childProcess';

describe('ChildProcess', function (): void {

	afterEach(function(): void {
		sinon.restore();
	});

	describe('executeCommand', function(): void {
		[[], ['test']].forEach(args => {
			it(`Output channel is used with ${JSON.stringify(args)} args`, async function (): Promise<void> {
				const logStub = sinon.stub(Logger, 'log');
				await executeCommand('echo', args);
				should(logStub.called).be.true('Log should have been called');
			});
		});

		it('Gets expected output', async function (): Promise<void> {
			const echoOutput = 'test';
			const output = await executeCommand('echo', [echoOutput]);
			should(output.stdout).equal(echoOutput);
		});

		it('Invalid command errors', async function (): Promise<void> {
			await should(executeCommand('invalid_command', [])).be.rejected();
		});
	});

	describe('executeSudoCommand', function(): void {
		it('Gets expected stdout output', async function (): Promise<void> {
			const stdout = 'stdout output';
			sinon.stub(sudo, 'exec').callsFake( (_cmd, _options, callback) => {
				callback!(undefined, stdout);
			});
			const result = await executeSudoCommand('echo');
			should(result.stdout).equal(stdout);
			should(result.stderr).equal('');
		});

		it('Gets expected stderr output', async function (): Promise<void> {
			const stderr = 'stderr output';
			sinon.stub(sudo, 'exec').callsFake( (_cmd, _options, callback) => {
				callback!(undefined, undefined, stderr);
			});
			const result = await executeSudoCommand('echo');
			should(result.stdout).equal('');
			should(result.stderr).equal(stderr);
		});

		it('Error rejects', async function (): Promise<void> {
			sinon.stub(sudo, 'exec').callsFake( (_cmd, _options, callback) => {
				callback!(new Error('error'));
			});
			await should(executeSudoCommand('invalid_command')).be.rejected();
		});
	});

});
