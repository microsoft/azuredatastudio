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
import * as TypeMoq from 'typemoq';
import { eulaAccepted } from '../constants';

const oldAzdataMock = new azdata.AzdataTool('/path/to/azdata', azdata.MIN_AZDATA_VERSION.raw);
const currentAzdataMock = new azdata.AzdataTool('/path/to/azdata', '9999.999.999');

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
					it('edit no optional args', async function (): Promise<void> {
						await azdataTool.arc.postgres.server.edit(name, {});
						verifyExecuteCommandCalledWithArgs([
							'arc', 'postgres', 'server', 'edit',
							name]);
						verifyExecuteCommandCalledWithoutArgs([
							'--admin-password',
							'--cores-limit',
							'--cores-request',
							'--engine-settings',
							'--extensions',
							'--memory-limit',
							'--memory-request',
							'--no-wait',
							'--port',
							'--replace-engine-settings',
							'--workers']);
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

		it('login', async function (): Promise<void> {
			const endpoint = 'myEndpoint';
			const username = 'myUsername';
			const password = 'myPassword';
			await azdataTool.login({ endpoint: endpoint }, username, password);
			verifyExecuteCommandCalledWithArgs(['login', endpoint, username]);
		});

		it('version', async function (): Promise<void> {
			executeCommandStub.resolves({ stdout: '1.0.0', stderr: '' });
			await azdataTool.version();
			verifyExecuteCommandCalledWithArgs(['--version']);
		});

		/**
		 * Verifies that the specified args were included in the call to executeCommand
		 * @param args The args to check were included in the execute command call
		 */
		function verifyExecuteCommandCalledWithArgs(args: string[], callIndex = 0): void {
			const commandArgs = executeCommandStub.args[callIndex][1] as string[];
			args.forEach(arg => should(commandArgs).containEql(arg));
		}

		/**
		 * Verifies that the specified args weren't included in the call to executeCommand
		 * @param args The args to check weren't included in the execute command call
		 */
		function verifyExecuteCommandCalledWithoutArgs(args: string[]): void {
			const commandArgs = executeCommandStub.args[0][1] as string[];
			args.forEach(arg => should(commandArgs).not.containEql(arg));
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

		let errorMessageStub: sinon.SinonStub;
		beforeEach(function (): void {
			errorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').returns(Promise.resolve(<any>loc.yes));
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

		it('skipped install - dont prompt config', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => 'dontPrompt');
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			switch (process.platform) {
				case 'win32':
					await testWin32SkippedInstall();
					break;
				case 'darwin':
					await testDarwinSkippedInstall();
					break;
				case 'linux':
					await testLinuxSkippedInstall();
					break;
			}
		});

		it('skipped install - user chose not to prompt', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.prompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			errorMessageStub.resolves(<any>loc.doNotAskAgain);
			switch (process.platform) {
				case 'win32':
					await testWin32SkippedInstall();
					break;
				case 'darwin':
					await testDarwinSkippedInstall();
					break;
				case 'linux':
					await testLinuxSkippedInstall();
					break;
			}
			configMock.verify(x => x.update(TypeMoq.It.isAny(), azdata.AzdataDeployOption.dontPrompt, TypeMoq.It.isAny()), TypeMoq.Times.once());
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
		let showInformationMessageStub: sinon.SinonStub;

		beforeEach(function (): void {
			showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').returns(Promise.resolve(<any>loc.yes));
			executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: '', stderr: '' }));
			sinon.stub(HttpClient, 'getTextContent').resolves(JSON.stringify(releaseJson));
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

		it('successful update - always prompt if user requested', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.dontPrompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			switch (process.platform) {
				case 'win32':
					await testWin32SuccessfulUpdate(true);
					break;
				case 'darwin':
					await testDarwinSuccessfulUpdate(true);
					break;
				case 'linux':
					await testLinuxSuccessfulUpdate(true);
					break;
			}
		});

		it('skipped update - config set not to prompt', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.dontPrompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			switch (process.platform) {
				case 'win32':
					await testWin32SkippedUpdateDontPrompt();
					break;
				case 'darwin':
					await testDarwinSkippedUpdateDontPrompt();
					break;
				case 'linux':
					await testLinuxSkippedUpdateDontPrompt();
					break;
			}
		});

		it('skipped update - user chose to never prompt again', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.prompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			showInformationMessageStub.resolves(<any>loc.doNotAskAgain);
			switch (process.platform) {
				case 'win32':
					await testWin32SkippedUpdateDontPrompt();
					break;
				case 'darwin':
					await testDarwinSkippedUpdateDontPrompt();
					break;
				case 'linux':
					await testLinuxSkippedUpdateDontPrompt();
					break;
			}
			// Config should have been updated since user chose never to prompt again
			configMock.verify(x => x.update(TypeMoq.It.isAny(), azdata.AzdataDeployOption.dontPrompt, TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		it('skipped update - no new version', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32SkippedUpdate();
					break;
				case 'darwin':
					await testDarwinSkippedUpdate();
					break;
				case 'linux':
					await testLinuxSkippedUpdate();
					break;
			}
		});

		it('skipped update - no azdata', async function (): Promise<void> {
			const result = await azdata.checkAndUpdateAzdata();
			should(result).be.false();
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
				await azdata.discoverLatestAvailableAzdataVersion();
			});
		});
	});

	describe('promptForEula', function (): void {
		it('skipped because of config', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.dontPrompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const result = await azdata.promptForEula(mementoMock.object);
			should(result).be.false();
		});

		it('always prompt if user requested', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.dontPrompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
			const result = await azdata.promptForEula(mementoMock.object, true);
			should(result).be.false();
			should(showInformationMessage.calledOnce).be.true('showInformationMessage should have been called to prompt user');
		});

		it('prompt if config set to do so', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.prompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
			const result = await azdata.promptForEula(mementoMock.object);
			should(result).be.false();
			should(showInformationMessage.calledOnce).be.true('showInformationMessage should have been called to prompt user');
		});

		it('update config if user chooses not to prompt', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.prompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage').resolves(<any>loc.doNotAskAgain);
			const result = await azdata.promptForEula(mementoMock.object);
			configMock.verify(x => x.update(TypeMoq.It.isAny(), azdata.AzdataDeployOption.dontPrompt, TypeMoq.It.isAny()), TypeMoq.Times.once());
			should(result).be.false('EULA should not have been accepted');
			should(showInformationMessage.calledOnce).be.true('showInformationMessage should have been called to prompt user');
		});

		it('user accepted EULA', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.prompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage').resolves(<any>loc.accept);
			const result = await azdata.promptForEula(mementoMock.object);
			mementoMock.verify(x => x.update(eulaAccepted, true), TypeMoq.Times.once());
			should(result).be.true('EULA should have been accepted');
			should(showInformationMessage.calledOnce).be.true('showInformationMessage should have been called to prompt user');
		});

		it('user accepted EULA - require user action', async function (): Promise<void> {
			const configMock = TypeMoq.Mock.ofType<vscode.WorkspaceConfiguration>();
			configMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => azdata.AzdataDeployOption.prompt);
			sinon.stub(vscode.workspace, 'getConfiguration').returns(configMock.object);
			const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
			const showErrorMessage = sinon.stub(vscode.window, 'showErrorMessage').resolves(<any>loc.accept);
			const result = await azdata.promptForEula(mementoMock.object, true, true);
			mementoMock.verify(x => x.update(eulaAccepted, true), TypeMoq.Times.once());
			should(result).be.true('EULA should have been accepted');
			should(showErrorMessage.calledOnce).be.true('showErrorMessage should have been called to prompt user');
		});
	});

	describe('isEulaAccepted', function (): void {
		const mementoMock = TypeMoq.Mock.ofType<vscode.Memento>();
		mementoMock.setup(x => x.get(TypeMoq.It.isAny())).returns(() => true);
		should(azdata.isEulaAccepted(mementoMock.object)).be.true();
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

async function testLinuxSuccessfulUpdate(userRequested = false) {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	executeSudoCommandStub.resolves({ stdout: '0.0.0', stderr: '' });
	await azdata.checkAndUpdateAzdata(oldAzdataMock, userRequested);
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledOnce).be.true();
}

async function testDarwinSuccessfulUpdate(userRequested = false) {
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
	await azdata.checkAndUpdateAzdata(oldAzdataMock, userRequested);
	should(executeCommandStub.callCount).be.equal(6);
	should(executeCommandStub.getCall(2).args[0]).be.equal('brew', '3rd call should have been to brew');
	should(executeCommandStub.getCall(2).args[1]).deepEqual(['info', 'azdata-cli', '--json'], '3rd call did not have expected arguments');
}


async function testWin32SuccessfulUpdate(userRequested = false) {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	await azdata.checkAndUpdateAzdata(oldAzdataMock, userRequested);
	should(executeSudoCommandStub.calledOnce).be.true('executeSudoCommand should have been called once');
	should(executeSudoCommandStub.getCall(0).args[0]).startWith('msiexec /qn /i');
}

async function testLinuxSkippedUpdate() {
	executeSudoCommandStub.resolves({ stdout: '0.0.0', stderr: '' });
	await azdata.checkAndUpdateAzdata(currentAzdataMock);
	should(executeSudoCommandStub.callCount).be.equal(0, 'executeSudoCommand was not expected to be called');
}

async function testDarwinSkippedUpdateDontPrompt() {
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
	should(executeCommandStub.notCalledWith(sinon.match.any, sinon.match.array.contains(['upgrade', 'azdata-cli'])));
}

async function testWin32SkippedUpdateDontPrompt() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(executeSudoCommandStub.notCalled).be.true(`executeSudoCommand should not have been called ${executeSudoCommandStub.getCalls().join(os.EOL)}`);
}

async function testLinuxSkippedUpdateDontPrompt() {
	sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: '0.0.0', stderr: '' }));
	executeSudoCommandStub.resolves({ stdout: '0.0.0', stderr: '' });
	await azdata.checkAndUpdateAzdata(oldAzdataMock);
	should(executeSudoCommandStub.callCount).be.equal(0, 'executeSudoCommand was not expected to be called');
}

async function testDarwinSkippedUpdate() {
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
	await azdata.checkAndUpdateAzdata(currentAzdataMock);
	should(executeCommandStub.callCount).be.equal(6);
	should(executeCommandStub.notCalledWith(sinon.match.any, sinon.match.array.contains(['upgrade', 'azdata-cli'])));
}

async function testWin32SkippedUpdate() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	await azdata.checkAndUpdateAzdata(currentAzdataMock);
	should(executeSudoCommandStub.notCalled).be.true('executeSudoCommand should not have been called');
}

async function testDarwinSkippedInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onFirstCall()
		.callsFake(async (_command: string, _args: string[]) => {
			return Promise.reject(new Error('not Found'));
		})
		.callsFake(async (_command: string, _args: string[]) => {
			return Promise.resolve({ stdout: '0.0.0', stderr: '' });
		});
	const result = await azdata.checkAndInstallAzdata();
	should(result).equal(undefined, 'result should be undefined');
	should(executeCommandStub.callCount).be.equal(0);
}

async function testLinuxSkippedInstall() {
	sinon.stub(childProcess, 'executeCommand')
		.onFirstCall()
		.rejects(new Error('not Found'))
		.resolves({ stdout: '0.0.0', stderr: '' });
	executeSudoCommandStub
		.resolves({ stdout: 'success', stderr: '' });
	const result = await azdata.checkAndInstallAzdata();
	should(result).equal(undefined, 'result should be undefined');
	should(executeSudoCommandStub.callCount).be.equal(0);
}

async function testWin32SkippedInstall() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	sinon.stub(childProcess, 'executeCommand')
		.onFirstCall()
		.rejects(new Error('not Found')) // First call mock the tool not being found
		.resolves({ stdout: '1.0.0', stderr: '' });
	executeSudoCommandStub
		.returns({ stdout: '', stderr: '' });
	const result = await azdata.checkAndInstallAzdata();
	should(result).equal(undefined, 'result should be undefined');
	should(executeSudoCommandStub.notCalled).be.true('executeSudoCommand should not have been called');
}

async function testWin32SuccessfulInstall() {
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
