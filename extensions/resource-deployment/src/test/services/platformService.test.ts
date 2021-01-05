/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as fs from 'fs';
import 'mocha';
import * as os from 'os';
import * as cp from 'promisify-child-process';
import * as should from 'should';
import * as sinon from 'sinon';
import * as sudo from 'sudo-prompt';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { tryExecuteAction } from '../../common/utils';
import { OsDistribution } from '../../interfaces';
import { extensionOutputChannel, PlatformService } from '../../services/platformService';
import { TestChildProcessPromise } from '../stubs';

const globalStoragePath = os.tmpdir();
const platformService = new PlatformService(globalStoragePath);

describe('PlatformService', () => {
	beforeEach('PlatformService setup', async () => {
		await platformService.initialize();
	});
	afterEach('PlatformService cleanup', () => {
		sinon.restore();
	});
	it('storagePath', () => {
		const result = platformService.storagePath();
		result.should.equal(globalStoragePath);
	});
	it('platform', () => {
		const result = platformService.platform();
		result.should.equal(process.platform);
	});
	it('outputChannelName', () => {
		const result = platformService.outputChannelName();
		result.should.equal(extensionOutputChannel);
	});
	describe('output channel', () => {
		let outputChannelStub: TypeMoq.IMock<vscode.OutputChannel>;
		beforeEach('output channel setup', () => {
			outputChannelStub = TypeMoq.Mock.ofType<vscode.OutputChannel>();
		});
		it('showOutputChannel', () => {
			outputChannelStub.setup(c => c.show(TypeMoq.It.isAny())).callback((preserveFocus => {
				preserveFocus.should.be.true();
			}));
			platformService.showOutputChannel(true);
		});
		describe('logToOutputChannel', () => {
			['', undefined, 'header'].forEach(header => {
				it(`header = ${header}`, () => {
					const data = 'data';
					outputChannelStub.setup(c => c.appendLine(TypeMoq.It.isAny())).callback((line => {
						line.should.equal(header + line);
					}));
					platformService.logToOutputChannel(data, header);
				});
			});
		});
	});
	it('osDistribution', () => {
		const result = platformService.osDistribution();
		switch (process.platform) {
			case 'darwin': result.should.equal(OsDistribution.darwin); break;
			case 'win32': result.should.equal(OsDistribution.win32); break;
			case 'linux': result.should.equal(OsDistribution.debian); break;
			default: result.should.equal(OsDistribution.others); break;
		}
	});
	describe('file/directory', () => {
		const filePath = __filename;
		const contents = __dirname; //a known value
		[true, false, 'throws'].forEach((fileExists => {
			it(`fileExists - ${fileExists}`, async () => {
				switch (fileExists) {
					case true: (await platformService.fileExists(filePath)).should.be.true(); break;
					case false: {
						sinon.stub(fs.promises, 'access').rejects({ code: 'ENOENT' });
						(await platformService.fileExists(filePath)).should.be.false();
						break;
					}
					case 'throws': {
						sinon.stub(fs.promises, 'access').rejects({});
						const { error } = await tryExecuteAction(() => platformService.fileExists(filePath));
						should(error).not.be.undefined();
						break;
					}
					default: throw new Error('unexpected error');
				}
			});
		}));
		describe('deleteFile', () => {
			[true, false].forEach(fileExists => {
				it(`fileExists - ${fileExists}`, async () => {
					if (fileExists) {
						const stub = sinon.stub(fs.promises, 'unlink').resolves();
						await platformService.deleteFile(filePath);
						stub.callCount.should.equal(1);
						stub.getCall(0).args[0].should.equal(filePath);
					} else {
						sinon.stub(fs.promises, 'access').rejects({ code: 'ENOENT' }); // causes fileExists to return false
						const stub = sinon.stub(fs.promises, 'unlink').resolves();
						await platformService.deleteFile(filePath);
						stub.callCount.should.equal(0); // verifies that unlink was not called
					}
				});
			});
			[true, false].forEach(async ignoreError => {
				it(`throws with ignoreError: ${ignoreError}`, async () => {
					const stub = sinon.stub(fs.promises, 'unlink').throws();
					const { error } = await tryExecuteAction(() => platformService.deleteFile(filePath, ignoreError));
					stub.callCount.should.equal(1);
					stub.getCall(0).args[0].should.equal(filePath);
					if (ignoreError) {
						should(error).be.undefined();
					} else {
						should(error).not.be.undefined();
					}
				});
			});
		});
		it('openFile', () => {
			const stub = sinon.stub(vscode.commands, 'executeCommand').resolves(); //resolves with a known string
			platformService.openFile(filePath);
			const expectedFilePath = vscode.Uri.file(filePath).fsPath;
			stub.callCount.should.equal(1);
			stub.getCall(0).args[0].should.equal('vscode.open');
			(stub.getCall(0).args[1] as vscode.Uri).fsPath.should.equal(expectedFilePath);
		});
		it('readTextFile', async () => {
			sinon.stub(fs.promises, 'readFile').resolves(contents);
			const result = await platformService.readTextFile(filePath);
			result.should.equal(contents);
		});
		it('saveTextFile', async () => {
			const stub = sinon.stub(fs.promises, 'writeFile').resolves(); //resolves with a known string
			await platformService.saveTextFile(contents, filePath);
			stub.callCount.should.equal(1);
			stub.getCall(0).args[0].should.equal(filePath);
			stub.getCall(0).args[1].should.equal(contents);
		});
		it('copyFile', async () => {
			const target = __dirname; //arbitrary path
			const stub = sinon.stub(fs.promises, 'copyFile').resolves();
			await platformService.copyFile(filePath, target);
			stub.callCount.should.equal(1);
			stub.getCall(0).args[0].should.equal(filePath);
			stub.getCall(0).args[1].should.equal(target);
		});
		it('makeDirectory ', async () => {
			const target = __dirname; //arbitrary path
			sinon.stub(fs.promises, 'access').rejects({ code: 'ENOENT' }); // this simulates the target directory to not Exist.
			const stub = sinon.stub(fs.promises, 'mkdir').resolves();
			await platformService.makeDirectory(target);
			stub.callCount.should.equal(1);
			stub.getCall(0).args[0].should.equal(target);
		});
	});
	it('showErrorMessage', () => {
		const error = __dirname; //arbitrary known string
		const stub = sinon.stub(vscode.window, 'showErrorMessage').resolves(); //resolves with a known string
		platformService.showErrorMessage(error);
		stub.callCount.should.equal(1);
		stub.getCall(0).args[0].should.equal(error);
	});
	describe('isNotebookNameUsed', () => {
		[true, false].forEach((isUsed => {
			it(`return value: ${isUsed}`, () => {
				const title = __filename; //arbitrary known string
				if (isUsed) {
					sinon.stub(azdata.nb, 'notebookDocuments').get(() => [{ isUntitled: true, fileName: title }]);
					sinon.stub(vscode.workspace, 'textDocuments').get(() => [{ isUntitled: true, fileName: title }]);
				} else {
					sinon.stub(azdata.nb, 'notebookDocuments').get(() => [{ isUntitled: true, fileName: '' }]);
					sinon.stub(vscode.workspace, 'textDocuments').get(() => [{ isUntitled: true, fileName: '' }]);
				}
				const result = platformService.isNotebookNameUsed(title);
				result.should.equal(isUsed);
			});
		}));
	});
	describe('runCommand', () => {
		[
			{ commandSucceeds: true },
			{ commandSucceeds: false, ignoreError: true },
			{ commandSucceeds: false, ignoreError: false },
		].forEach(({ commandSucceeds, ignoreError }) => {
			if (ignoreError && commandSucceeds) {
				return; //exit out of the loop as we do not handle ignoreError when command is successful
			}
			it(`non-sudo, commandSucceeds: ${commandSucceeds}, ignoreError: ${ignoreError}`, async () => {
				const command = __dirname; // arbitrary command string, and success string on successful execution and error string on error
				const child = new TestChildProcessPromise<cp.Output>();
				const stub = sinon.stub(cp, 'spawn').returns(child);
				const runningCommand = platformService.runCommand(command, { commandTitle: 'title', ignoreError: ignoreError });
				// fake runCommand to behave like echo, returning the command back as stdout/stderr/error.
				// TestChildProcessPromise object shares the stdout/stderr stream for convenience with the child stream.
				if (commandSucceeds) {
					child.emit('data', command);
					child.emit('exit', 0, null); //resolve with 0 exit code
					child.resolve({ stdout: command });
				} else {
					child.emit('data', command);
					child.emit('exit', 1, null); // resolve with non-zero exit code
					child.reject({ stderr: command });
				}
				const { result, error } = await tryExecuteAction(() => runningCommand);
				verifyCommandExecution(stub, result, error, command, commandSucceeds, ignoreError);
			});

			it(`sudo, commandSucceeds: ${commandSucceeds}, ignoreError: ${ignoreError}`, async () => {
				const command = __dirname; // arbitrary command string, and success string on successful execution
				const stub = sinon.stub(sudo, 'exec').callsFake((cmd, _options, cb) => {
					// behaves like echo, returning the _cmd back as stdout/stderr/error.
					if (commandSucceeds) {
						cb(''/* error */, cmd/* stdout */, ''/* stderr */);
					} else {
						cb(cmd/* error */, ''/* stdout */, cmd/* stderr */);
					}
				});
				const { error, result } = await tryExecuteAction(() => platformService.runCommand(command, { commandTitle: 'title', ignoreError: ignoreError, sudo: true, workingDirectory: __dirname }));
				verifyCommandExecution(stub, result, error, command, commandSucceeds, ignoreError);
			});
		});
	});
});

function verifyCommandExecution(stub: sinon.SinonStub, result: string | undefined, error: any, command: string, commandSucceeds: boolean | undefined, ignoreError: boolean | undefined) {
	stub.callCount.should.equal(1);
	if (commandSucceeds) {
		result!.should.equal(command);
	} else {
		if (ignoreError) {
			should(error).be.undefined();
			(result === undefined || result.length === 0).should.be.true('result should be an empty string or be undefined when an error occurs');
		} else {
			should(error).not.be.undefined();
		}
	}
}
