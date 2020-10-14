/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as azdata from '../azdata';
import * as childProcess from '../common/childProcess';
import { HttpClient } from '../common/httpClient';
import * as utils from '../common/utils';
import * as loc from '../localizedConstants';
import * as os from 'os';
import * as fs from 'fs';
import { AzdataReleaseInfo } from '../azdataReleaseInfo';

const oldAzdataMock = new azdata.AzdataTool('/path/to/azdata', '0.0.0');

/**
 * This matches the schema of the JSON file used to determine the current version of
 * azdata - do not modify unless also updating the corresponding JSON file
 */
const releaseJson: AzdataReleaseInfo = {
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
let executeSudoCommandStub: sinon.SinonStub;

describe('azdata', function () {
	afterEach(function (): void {
		sinon.restore();
	});
	describe('azdataTool', function (): void {
		const azdataTool = new azdata.AzdataTool(os.tmpdir(), '1.0.0');
		let executeCommandStub: sinon.SinonStub;
		const namespace = 'myNamespace';
		const name = 'myName';
		const connectivityMode = 'myConnectivityMode';
		const resourceGroup = 'myResourceGroup';
		const location = 'myLocation';
		const subscription = 'mySubscription';
		const profileName = 'myProfileName';
		const storageClass = 'myStorageClass';

		beforeEach(function (): void {
			executeCommandStub = sinon.stub(childProcess, 'executeCommand').resolves({ stdout: '{}', stderr: '' });
		});

		describe('arc', function (): void {
			describe('dc', function (): void {
				it('create', async function (): Promise<void> {
					await azdataTool.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass);
					verifyExecuteCommandCalledWithArgs([
						'arc', 'dc', 'create',
						namespace,
						name,
						connectivityMode,
						resourceGroup,
						location,
						subscription,
						profileName,
						storageClass]);
				});
				describe('endpoint', async function (): Promise<void> {
					it('list', async function (): Promise<void> {
						await azdataTool.arc.dc.endpoint.list();
						verifyExecuteCommandCalledWithArgs(['arc', 'dc', 'endpoint', 'list']);
					});
				});
				describe('config', async function (): Promise<void> {
					it('list', async function (): Promise<void> {
						await azdataTool.arc.dc.config.list();
						verifyExecuteCommandCalledWithArgs(['arc', 'dc', 'config', 'list']);
					});
					it('show', async function (): Promise<void> {
						await azdataTool.arc.dc.config.show();
						verifyExecuteCommandCalledWithArgs(['arc', 'dc', 'config', 'show']);
					});
				});
			});
			describe('postgres', function (): void {
				describe('server', function (): void {
					it('delete', async function (): Promise<void> {
						await azdataTool.arc.postgres.server.delete(name);
						verifyExecuteCommandCalledWithArgs(['arc', 'postgres', 'server', 'delete', name]);
					});
					it('list', async function (): Promise<void> {
						await azdataTool.arc.postgres.server.list();
						verifyExecuteCommandCalledWithArgs(['arc', 'postgres', 'server', 'list']);
					});
					it('show', async function (): Promise<void> {
						await azdataTool.arc.postgres.server.show(name);
						verifyExecuteCommandCalledWithArgs(['arc', 'postgres', 'server', 'show', name]);
					});
					it('edit', async function (): Promise<void> {
						const args = {
							adminPassword: true,
							coresLimit: 'myCoresLimit',
							coresRequest: 'myCoresRequest',
							engineSettings: 'myEngineSettings',
							extensions: 'myExtensions',
							memoryLimit: 'myMemoryLimit',
							memoryRequest: 'myMemoryRequest',
							noWait: true,
							port: 1337,
							replaceEngineSettings: true,
							workers: 2
						};
						await azdataTool.arc.postgres.server.edit(name, args);
						verifyExecuteCommandCalledWithArgs([
							'arc', 'postgres', 'server', 'edit',
							name,
							'--admin-password',
							args.coresLimit,
							args.coresRequest,
							args.engineSettings,
							args.extensions,
							args.memoryLimit,
							args.memoryRequest,
							'--no-wait',
							args.port.toString(),
							'--replace-engine-settings',
							args.workers.toString()]);
					});
				});
			});
			describe('sql', function (): void {
				describe('mi', function (): void {
					it('delete', async function (): Promise<void> {
						await azdataTool.arc.sql.mi.delete(name);
						verifyExecuteCommandCalledWithArgs(['arc', 'sql', 'mi', 'delete', name]);
					});
					it('list', async function (): Promise<void> {
						await azdataTool.arc.sql.mi.list();
						verifyExecuteCommandCalledWithArgs(['arc', 'sql', 'mi', 'list']);
					});
					it('show', async function (): Promise<void> {
						await azdataTool.arc.sql.mi.show(name);
						verifyExecuteCommandCalledWithArgs(['arc', 'sql', 'mi', 'show', name]);
					});
				});
			});
			it('login', async function (): Promise<void> {
				const endpoint = 'myEndpoint';
				const username = 'myUsername';
				const password = 'myPassword';
				await azdataTool.login(endpoint, username, password);
				verifyExecuteCommandCalledWithArgs(['login', endpoint, username]);
			});
			it('version', async function (): Promise<void> {
				executeCommandStub.resolves({ stdout: '1.0.0', stderr: '' });
				await azdataTool.version();
				verifyExecuteCommandCalledWithArgs(['--version']);
			});
			it('general error throws', async function (): Promise<void> {
				const err = new Error();
				executeCommandStub.throws(err);
				try {
					await azdataTool.arc.dc.endpoint.list();
					throw new Error('command should have failed');
				} catch (error) {
					should(error).equal(err);
				}
			});
			it('ExitCodeError handled and parsed correctly', async function (): Promise<void> {
				const errorInnerText = 'my error text';
				const err = new childProcess.ExitCodeError(1, `ERROR { "stderr": "${errorInnerText}"}`);
				executeCommandStub.throws(err);
				try {
					await azdataTool.arc.dc.endpoint.list();
					throw new Error('command should have failed');
				} catch (error) {
					should(error).equal(err);
					should((error as childProcess.ExitCodeError).stderr).equal(errorInnerText);
				}
			});
			it('ExitCodeError general error with azdata tool existing rethrows original error', async function (): Promise<void> {
				sinon.stub(fs.promises, 'access').resolves();
				const err = new childProcess.ExitCodeError(1, 'some other error');
				executeCommandStub.throws(err);
				try {
					await azdataTool.arc.dc.endpoint.list();
					throw new Error('command should have failed');
				} catch (error) {
					should(error).equal(err);
				}
			});
			it('ExitCodeError general error with azdata tool not existing throws NoAzdataError', async function (): Promise<void> {
				sinon.stub(fs.promises, 'access').throws(new Error('not found'));
				const err = new childProcess.ExitCodeError(1, 'some other error');
				executeCommandStub.throws(err);
				try {
					await azdataTool.arc.dc.endpoint.list();
					throw new Error('command should have failed');
				} catch (error) {
					should(error instanceof utils.NoAzdataError).be.true('error should have been instance of NoAzdataError');
				}
			});
		});

		function verifyExecuteCommandCalledWithArgs(args: string[]): void {
			const commandArgs = executeCommandStub.args[0][1] as string[];
			args.forEach(arg => should(commandArgs).containEql(arg));
		}
	});

	describe('findAzdata', function (): void {
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
			executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: '', stderr: '' }));
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
				sinon.stub(childProcess, 'executeCommand')
					.onFirstCall()
					.rejects(new Error('not Found')) // First call mock the tool not being found
					.resolves({ stdout: '1.0.0', stderr: '' });
				const azdataTool = await azdata.checkAndInstallAzdata();
				should(azdataTool).be.undefined();
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

	describe('updateAzdata', function (): void {
		beforeEach(function (): void {
			sinon.stub(vscode.window, 'showInformationMessage').returns(Promise.resolve(<any>loc.yes));
			executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: '', stderr: '' }));
		});

		it('successful update', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32SuccessfulUpdate();
					break;
				case 'darwin':
					await testDarwinSuccessfulUpdate();
					break;
				case 'linux':
					await testLinuxSuccessfulUpdate();
					break;
			}
		});


		it('unsuccessful update', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32UnsuccessfulUpdate();
					break;
				case 'darwin':
					await testDarwinUnsuccessfulUpdate();
					break;
				case 'linux':
					await testLinuxUnsuccessfulUpdate();
			}
		});

		describe('discoverLatestAvailableAzdataVersion', function (): void {
			it('finds latest available version of azdata successfully', async function (): Promise<void> {
				sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(releaseJson));
				await azdata.discoverLatestAvailableAzdataVersion();
			});
		});
	});
});

async function testLinuxUnsuccessfulUpdate() {
	executeSudoCommandStub.rejects();
	const updateDone = await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(updateDone).be.false();
	should(executeSudoCommandStub.calledOnce).be.true();
}

async function testDarwinUnsuccessfulUpdate() {
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
		.callsFake(async (_command: string, _args: string[]) => {
			return Promise.resolve({
				stderr: '',
				stdout: JSON.stringify(brewInfoOutput)
			});
		})
		.onCall(5) //6th call is the first one to do actual update, the call number are 0 indexed
		.callsFake(async (_command: string, _args: string[]) => {
			return Promise.reject(new Error('not Found'));
		})
		.callsFake(async (_command: string, _args: string[]) => { // by default return success
			return Promise.resolve({ stderr: '', stdout: 'success' });
		});
	const updateDone = await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(updateDone).be.false();
	should(executeCommandStub.callCount).equal(6);
}

async function testWin32UnsuccessfulUpdate() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	executeSudoCommandStub.rejects();
	const updateDone = await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(updateDone).be.false('Update should not have been successful');
	should(executeSudoCommandStub.calledOnce).be.true();
}

async function testLinuxSuccessfulUpdate() {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	executeSudoCommandStub.resolves({ stdout: '0.0.0', stderr: '' });
	await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledOnce).be.true();
}

async function testDarwinSuccessfulUpdate() {
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
		.resolves({
			stderr: '',
			stdout: JSON.stringify(brewInfoOutput)
		})
		.resolves({ stdout: '0.0.0', stderr: '' });
	await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(executeCommandStub.callCount).be.equal(6);
	should(executeCommandStub.getCall(2).args[0]).be.equal('brew', '3rd call should have been to brew');
	should(executeCommandStub.getCall(2).args[1]).deepEqual(['info', 'azdata-cli', '--json'], '3rd call did not have expected arguments');
}


async function testWin32SuccessfulUpdate() {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(executeSudoCommandStub.calledOnce).be.true('executeSudoCommand should have been called once');
	should(executeSudoCommandStub.getCall(0).args[0]).startWith('msiexec /qn /i');
}

async function testWin32SuccessfulInstall() {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall()
		.rejects(new Error('not Found')) // First call mock the tool not being found
		.resolves({ stdout: '1.0.0', stderr: '' });
	executeSudoCommandStub
		.returns({ stdout: '', stderr: '' });
	await azdata.checkAndInstallAzdata();
	should(executeCommandStub.calledTwice).be.true(`executeCommand should have been called twice. Actual ${executeCommandStub.getCalls().length}`);
	should(executeSudoCommandStub.calledOnce).be.true(`executeSudoCommand should have been called once. Actual ${executeSudoCommandStub.getCalls().length}`);
	should(executeSudoCommandStub.getCall(0).args[0]).startWith('msiexec /qn /i');
}

async function testDarwinSuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall()
		.callsFake(async (_command: string, _args: string[]) => {
			return Promise.reject(new Error('not Found'));
		})
		.callsFake(async (_command: string, _args: string[]) => {
			return Promise.resolve({ stdout: '0.0.0', stderr: '' });
		});
	await azdata.checkAndInstallAzdata();
	should(executeCommandStub.callCount).be.equal(5);
}

async function testLinuxSuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall()
		.rejects(new Error('not Found'))
		.resolves({ stdout: '0.0.0', stderr: '' });
	executeSudoCommandStub
		.resolves({ stdout: 'success', stderr: '' });
	await azdata.checkAndInstallAzdata();
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledThrice).be.true();
}

async function testLinuxUnsuccessfulInstall() {
	executeSudoCommandStub.rejects();
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
	executeSudoCommandStub.rejects();
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const downloadPromise = azdata.installAzdata();
	await should(downloadPromise).be.rejected();
	should(executeSudoCommandStub.calledOnce).be.true();
}
