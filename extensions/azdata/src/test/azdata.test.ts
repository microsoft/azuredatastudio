/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nock from 'nock';
import * as path from 'path';
import { SemVer } from 'semver';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as azdata from '../azdata';
import * as childProcess from '../common/childProcess';
import * as utils from '../common/utils';
import * as loc from '../localizedConstants';
import * as constants from '../constants';

const outputChannelMock = TypeMoq.Mock.ofType<vscode.OutputChannel>();
const oldAzdata = new azdata.AzdataTool('', new SemVer('0.0.0'), outputChannelMock.object);
if (process.env.SendOutputChannelToConsole) {
	outputChannelMock.setup(x => x.appendLine(TypeMoq.It.isAnyString())).callback((x => {
		console.log(`Output Channel:${x}`);
	}));
}
describe('azdata', function () {
	afterEach(function (): void {
		sinon.restore();
		nock.cleanAll();
		nock.enableNetConnect();
	});

	describe('findAzdata', function () {
		it('successful', async function (): Promise<void> {
			if (process.platform === 'win32') {
				// Mock searchForCmd to return a path to azdata.cmd
				sinon.stub(utils, 'searchForCmd').returns(Promise.resolve('C:\\path\\to\\azdata.cmd'));
			}
			// Mock call to --version to simulate azdata being installed
			sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: 'v1.0.0', stderr: '' }));
			await should(azdata.findAzdata(outputChannelMock.object)).not.be.rejected();
		});
		it('unsuccessful', async function (): Promise<void> {
			if (process.platform === 'win32') {
				// Mock searchForCmd to return a failure to find azdata.cmd
				sinon.stub(utils, 'searchForCmd').returns(Promise.reject(new Error('Could not find azdata')));
			} else {
				// Mock call to executeCommand to simulate azdata --version returning error
				sinon.stub(childProcess, 'executeCommand').returns(Promise.reject({ stdout: '', stderr: 'command not found: azdata' }));
			}
			await should(azdata.findAzdata(outputChannelMock.object)).be.rejected();
		});
	});

	describe('installAzdata', function (): void {
		it('successful install - win32', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'win32' });
				await testInstallOrUpgradeAzdataWin32(outputChannelMock);
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('successful install - macos', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'darwin' });
				const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, _args: string[]) => {
					should(command).be.equal('brew');
					return { stdout: 'success', stderr: '' };
				});
				await azdata.installAzdata(outputChannelMock.object);
				should(executeCommandStub.calledThrice).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('successful install - linux', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'linux' });
				const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, _args: string[]) => {
					should(command).be.equal('lsb_release');
					return { stdout: 'success', stderr: '' };
				});
				let callNumber = 0;
				const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').callsFake(async (command: string) => {
					++callNumber;
					switch (callNumber) {
						case 3:
							should(command).match(/^curl/);
							break;
						case 4:
							should(command).match(/^add-apt-repository/);
							break;
						default:
							should(command).match(/^apt-get/);
							break;
					}
					return { stdout: 'success', stderr: '' };
				});
				await azdata.installAzdata(outputChannelMock.object);
				should(executeSudoCommandStub.callCount).be.equal(6);
				should(executeCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('unsuccessful download - win32', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'win32' });
				nock(constants.azdataHostname)
					.get(`/${constants.azdataUri}`)
					.reply(404);
				const downloadPromise = azdata.installAzdata(outputChannelMock.object);
				await should(downloadPromise).be.rejected();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('unsuccessful install - win32', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'win32' });
				const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
				nock(constants.azdataHostname)
					.get(`/${constants.azdataUri}`)
					.replyWithFile(200, __filename);
				const downloadPromise = azdata.installAzdata(outputChannelMock.object);
				await should(downloadPromise).be.rejected();
				should(executeCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('unsuccessful install - macos', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'darwin' });
				const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
				const downloadPromise = azdata.installAzdata(outputChannelMock.object);
				await should(downloadPromise).be.rejected();
				should(executeCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('unsuccessful install - linux', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'linux' });
				const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').rejects();
				const downloadPromise = azdata.installAzdata(outputChannelMock.object);
				await should(downloadPromise).be.rejected();
				should(executeSudoCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});
	});

	describe('upgradeAzdata', function (): void {
		beforeEach(function (): void {
			sinon.stub(utils, 'discoverLatestAvailableAzdataVersion').returns(Promise.resolve(new SemVer('9999.999.999')));
			sinon.stub(vscode.window, 'showInformationMessage').returns(Promise.resolve(<any>loc.yes));
		});

		it('successful upgrade - win32', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'win32' });
				await testInstallOrUpgradeAzdataWin32(outputChannelMock, 'upgrade');
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('successful upgrade - macos', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'darwin' });
				const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, _args: string[]) => {
					should(command).be.equal('brew');
					return { stdout: 'success', stderr: '' };
				});
				await azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
				should(executeCommandStub.calledThrice);
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it.skip('successful upgrade - linux', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'darwin' });
				// const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, _args: string[]) => {
				// 	should(command).be.equal('add-apt-repository');
				// 	return { stdout: 'success', stderr: '' };
				// });
				// let callNumber = 0;
				// const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').callsFake(async (command: string) => {
				// 	callNumber++;
				// 	switch (callNumber) {
				// 		case 3:
				// 			should(command).match('/^curl/');
				// 			break;
				// 		case 4:
				// 			should(command).match('/^add-apt-repository/');
				// 			break;
				// 		default:
				// 			should(command).match('/^apt-get/');
				// 			break;
				// 	}
				// 	should(command).be.equal('brew');
				// 	return { stdout: 'success', stderr: '' };
				// });
				// await azdata.checkAndUpdateAzdata(currentAzdata, outputChannelMock.object);
				// should(executeSudoCommandStub.callCount).be.equal(6);
				// should(executeCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});


		it('unsuccessful upgrade - win32', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'win32' });
				nock(constants.azdataHostname)
					.get(`/${constants.azdataUri}`)
					.replyWithFile(200, __filename);
				sinon.stub(childProcess, 'executeCommand').rejects();
				const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
				await should(upgradePromise).be.rejected();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it('unsuccessful upgrade - macos', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'darwin' });
				const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
				const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
				await should(upgradePromise).be.rejected();
				should(executeCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});

		it.skip('unsuccessful upgrade - linux', async function (): Promise<void> {
			const originalPlatform = process.platform;
			try {
				Object.defineProperty(process, 'platform', { value: 'linux' });
				const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').rejects();
				const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
				await should(upgradePromise).be.rejected();

				should(executeSudoCommandStub.calledOnce).be.true();
			} finally {
				Object.defineProperty(process, 'platform', { value: originalPlatform });
			}
		});
	});
});

async function testInstallOrUpgradeAzdataWin32(outputChannelMock: TypeMoq.IMock<vscode.OutputChannel>, operation: 'install' | 'upgrade' = 'install') {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, args: string[]) => {
		should(command).be.equal('msiexec');
		should(args[0]).be.equal('/qn');
		should(args[1]).be.equal('/i');
		should(path.basename(args[2])).be.equal(constants.azdataUri);
		return { stdout: 'success', stderr: '' };
	});
	nock(constants.azdataHostname)
		.get(`/${constants.azdataUri}`)
		.replyWithFile(200, __filename);
	if (operation === 'install') {
		await azdata.installAzdata(outputChannelMock.object);
	} else {
		await azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	}
	should(executeCommandStub.calledOnce).be.true();
}

