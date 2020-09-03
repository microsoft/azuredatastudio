/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { SemVer } from 'semver';
import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as azdata from '../azdata';
import * as childProcess from '../common/childProcess';
import { HttpClient } from '../common/httpClient';
import * as utils from '../common/utils';
import * as loc from '../localizedConstants';
import * as constants from '../constants';

const oldAzdataMock = <azdata.AzdataTool>{ path: '/path/to/azdata', cachedVersion: new SemVer('0.0.0') };
const releaseJson = {
	win32: {
		'version': '9999.999.999',
		'link': 'https://download.com/azdata-20.0.1.msi'
	},
	darwin: {
		'version': '9999.999.999'
	},
	linux: {
		'version': '9999.999.999'
	}
};


describe('azdata', function () {
	afterEach(function (): void {
		sinon.restore();
	});

	describe('findAzdata', function () {
		it('successful', async function (): Promise<void> {
			// Mock searchForCmd to return a path to azdata.cmd
			sinon.stub(utils, 'searchForCmd').returns(Promise.resolve('/path/to/azdata'));
			// Mock call to --version to simulate azdata being installed
			sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: '1.0.0', stderr: '' }));
			await should(azdata.findAzdata()).not.be.rejected();
		});
		it('unsuccessful', async function (): Promise<void> {
			if (process.platform === 'win32') {
				// Mock searchForCmd to return a failure to find azdata.cmd
				sinon.stub(utils, 'searchForCmd').returns(Promise.reject(new Error('Could not find azdata')));
			} else {
				// Mock call to executeCommand to simulate azdata --version returning error
				sinon.stub(childProcess, 'executeCommand').returns(Promise.reject({ stdout: '', stderr: 'command not found: azdata' }));
			}
			await should(azdata.findAzdata()).be.rejected();
		});
	});

	describe('installAzdata', function (): void {
		beforeEach(function (): void {
			sinon.stub(vscode.window, 'showErrorMessage').returns(Promise.resolve(<any>loc.yes));
			sinon.stub(utils, 'searchForCmd').returns(Promise.resolve('/path/to/azdata'));
		});

		it('successful install', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32SuccessfulInstall();
					break;
				case 'darwin':
					await testDarwinSuccessfulInstall();
					break;
				case 'linux':
					await testLinuxSuccessfulInstall();
					break;
			}
		});

		if (process.platform === 'win32') {
			it('unsuccessful download - win32', async function (): Promise<void> {
				sinon.stub(HttpClient, 'downloadFile').rejects();
				const downloadPromise = azdata.checkAndInstallAzdata();
				await should(downloadPromise).be.rejected();
			});
		}

		it('unsuccessful install', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32UnsuccessfulInstall();
					break;
				case 'darwin':
					await testDarwinUnsuccessfulInstall();
					break;
				case 'linux':
					await testLinuxUnsuccessfulInstall();
					break;
			}
		});
	});

	describe('upgradeAzdata', function (): void {
		beforeEach(function (): void {
			sinon.stub(vscode.window, 'showInformationMessage').returns(Promise.resolve(<any>loc.yes));
		});

		it('successful upgrade', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32SuccessfulUpgrade();
					break;

				case 'darwin':
					await testDarwinSuccessfulUpgrade();
					break;
				case 'linux':
					await testLinuxSuccessfulUpgrade();
					break;
			}
		});


		it.skip('unsuccessful upgrade', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32UnsuccessfulUpgrade();
					break;
				case 'darwin':
					await testDarwinUnsuccessfulUpgrade();
					break;
				case 'linux':
					await testLinuxUnsuccessfulUpgrade();
			}
		});

		describe('discoverLatestAvailableAzdataVersion', function (): void {
			this.timeout(20000);
			it(`finds latest available version of azdata successfully`, async function (): Promise<void> {
				// if the latest version is not discovered then the following call throws failing the test
				await azdata.discoverLatestAvailableAzdataVersion();
			});
		});
	});
});

async function testLinuxUnsuccessfulUpgrade() {
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').rejects();
	const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdataMock);
	await should(upgradePromise).be.rejected();
	should(executeSudoCommandStub.calledOnce).be.true();
}

async function testDarwinUnsuccessfulUpgrade() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
	const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdataMock);
	await should(upgradePromise).be.rejected();
	should(executeCommandStub.calledOnce).be.true();
}

async function testWin32UnsuccessfulUpgrade() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	sinon.stub(childProcess, 'executeCommand').rejects();
	const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdataMock);
	await should(upgradePromise).be.rejected();
}

async function testLinuxSuccessfulUpgrade() {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	await azdata.checkAndUpgradeAzdata(oldAzdataMock);
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledOnce).be.true();
}

async function testDarwinSuccessfulUpgrade() {
	const brewInfoOutput = [{
		name: 'azdata-cli',
		full_name: 'microsoft/azdata-cli-release/azdata-cli',
		versions: {
			'stable': '9999.999.999',
			'devel': null,
			'head': null,
			'bottle': true
		}
	}];
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onThirdCall() //third call is brew info azdata-cli --json which needs to return json of new available azdata versions.
		.callsFake(async (command: string, args: string[]) => {
			should(command).be.equal('brew');
			should(args).deepEqual(['info', 'azdata-cli', '--json']);
			return Promise.resolve({
				stderr: '',
				stdout: JSON.stringify(brewInfoOutput)
			});
		})
		.callsFake(async (_command: string, _args: string[]) => { // return success on all other command executions
			return Promise.resolve({ stdout: '0.0.0', stderr: '' });
		});
	await azdata.checkAndUpgradeAzdata(oldAzdataMock);
	should(executeCommandStub.callCount).be.equal(6);
}

async function testWin32SuccessfulUpgrade() {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, args: string[]) => {
		should(command).be.equal('msiexec');
		should(args[0]).be.equal('/qn');
		should(args[1]).be.equal('/i');
		should(path.basename(args[2])).be.equal(constants.azdataUri);
		return { stdout: '0.0.0', stderr: '' };
	});
	await azdata.checkAndUpgradeAzdata(oldAzdataMock);
	should(executeCommandStub.calledOnce).be.true();
}

async function testWin32SuccessfulInstall() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall().rejects('not Found')
		.callsFake(async (command: string, args: string[]) => {
			should(command).be.equal('msiexec');
			should(args[0]).be.equal('/qn');
			should(args[1]).be.equal('/i');
			should(path.basename(args[2])).be.equal(constants.azdataUri);
			return { stdout: '0.0.0', stderr: '' };
		});
	await azdata.checkAndInstallAzdata();
	should(executeCommandStub.calledTwice).be.true();
}

async function testDarwinSuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall().rejects('not Found')
		.callsFake(async (_command: string, _args: string[]) => {
			//should(_command).be.equal('brew');
			return { stdout: '0.0.0', stderr: '' };
		});
	await azdata.checkAndInstallAzdata();
	should(executeCommandStub.callCount).be.equal(5);
}

async function testLinuxSuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall().rejects('not Found')
		.returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	await azdata.checkAndInstallAzdata();
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledTwice).be.true();
}

async function testLinuxUnsuccessfulInstall() {
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').rejects();
	const downloadPromise = azdata.installAzdata();
	await should(downloadPromise).be.rejected();
	should(executeSudoCommandStub.calledOnce).be.true();
}

async function testDarwinUnsuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
	const downloadPromise = azdata.installAzdata();
	await should(downloadPromise).be.rejected();
	should(executeCommandStub.calledOnce).be.true();
}

async function testWin32UnsuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const downloadPromise = azdata.installAzdata();
	await should(downloadPromise).be.rejected();
	should(executeCommandStub.calledOnce).be.true();
}
