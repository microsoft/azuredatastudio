/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as stream from 'stream';
import * as cp from 'child_process';
import * as si from '../../jupyter/serverInstance';
import 'mocha';
import * as sinon from 'sinon';
import * as utils from '../../common/utils';
import * as fs from 'fs-extra';

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { MockOutputChannel } from '../common/stubs';
import * as testUtils from '../common/testUtils';
import { LocalJupyterServerManager } from '../../jupyter/jupyterServerManager';

const successMessage = `[I 14:00:38.811 NotebookApp] The Jupyter Notebook is running at:
[I 14:00:38.812 NotebookApp] http://localhost:8891/?token=...
[I 14:00:38.812 NotebookApp] Use Control-C to stop this server and shut down all kernels (twice to skip confirmation).
`;
const expectedPort = '8891';

describe('Jupyter server instance', function (): void {
	let expectedPath = 'mydir/notebook.ipynb';
	let mockInstall: TypeMoq.IMock<JupyterServerInstallation>;
	let mockOutputChannel: TypeMoq.IMock<MockOutputChannel>;
	let serverInstance: si.PerFolderServerInstance;

	beforeEach(() => {
		mockInstall = TypeMoq.Mock.ofType(JupyterServerInstallation, undefined, undefined, '/root');
		mockOutputChannel = TypeMoq.Mock.ofType(MockOutputChannel);
		mockInstall.setup(i => i.outputChannel).returns(() => mockOutputChannel.object);
		mockInstall.setup(i => i.pythonExecutable).returns(() => 'python3');
		mockInstall.object.execOptions = { env: Object.assign({}, process.env) };
		serverInstance = new si.PerFolderServerInstance({
			documentPath: expectedPath,
			install: mockInstall.object
		});
		sinon.stub(si,'ensureProcessEnded').returns(undefined);
	});

	this.afterEach(function () {
		sinon.restore();
	});

	it('Should not be started initially', function (): void {
		// Given a new instance It should not be started
		should(serverInstance.isStarted).be.false();
		should(serverInstance.port).be.undefined();
	});

	it('Should create config and data directories on configure', async function (): Promise<void> {
		// Given a server instance
		let ensureDirSyncStub = sinon.stub(utils,'ensureDirSync').withArgs(sinon.match.any,sinon.match.any).returns();
		let copyStub = sinon.stub(fs,'copySync').returns();

		// When I run configure
		await serverInstance.configure();

		// Then I expect a folder to have been created with config and data subdirs
		sinon.assert.callCount(ensureDirSyncStub,5);
		sinon.assert.callCount(copyStub,3);
	});

	it('Should have URI info after start', async function (): Promise<void> {
		// Given startup will succeed
		let process = setupSpawn({
			sdtout: (listener: (msg: string) => void) => { },
			stderr: (listener: (msg: string) => void) => listener(successMessage)
		});
		let spawnStub = sinon.stub(cp,'spawn').returns(<cp.ChildProcess>process.object);
		should(spawnStub.calledOnce).be.false();

		// When I call start
		await serverInstance.start();
		should(spawnStub.calledOnce).be.true();

		// Then I expect all parts of the URI to be defined
		should(serverInstance.uri).not.be.undefined();
		should(serverInstance.uri.scheme).equal('http');
		let settings = LocalJupyterServerManager.getLocalConnectionSettings(serverInstance.uri);
		// Verify a token with expected length was generated
		should(settings.token).have.length(48);
		let hostAndPort = serverInstance.uri.authority.split(':');
		// verify port was set as expected
		should(hostAndPort[1]).length(4);
		should(hostAndPort[1]).equal(expectedPort);

		// And I expect it to be started
		should(serverInstance.isStarted).be.true();

		// And I expect listeners to be cleaned up
		process.verify(p => p.on(TypeMoq.It.isValue('error'), TypeMoq.It.isAny()), TypeMoq.Times.once());
		process.verify(p => p.on(TypeMoq.It.isValue('exit'), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Should throw if error before startup', async function (): Promise<void> {
		let error = 'myerr';
		let process = setupSpawn({
			sdtout: (listener: (msg: string) => void) => { },
			stderr: (listener: (msg: string) => void) => listener(successMessage),
			error: (listener: (msg: string | Error) => void) => setTimeout(() => listener(new Error(error)), 10)
		});
		sinon.stub(cp,'spawn').returns(<cp.ChildProcess>process.object);

		// When I call start then I expect it to pass
		await serverInstance.start();
	});

	it('Should throw if exit before startup', async function (): Promise<void> {
		let code = -1234;
		let process = setupSpawn({
			exit: (listener: (msg: string | number) => void) => listener(code)
		});
		sinon.stub(cp,'spawn').returns(<cp.ChildProcess>process.object);

		// When I call start then I expect the error to be thrown
		await testUtils.assertThrowsAsync(() => serverInstance.start(), undefined);
		should(serverInstance.isStarted).be.false();
	});

	it('Should call stop with correct port on close', async function (): Promise<void> {
		// Given startup will succeed
		let process = setupSpawn({
			sdtout: (listener: (msg: string) => void) => { },
			stderr: (listener: (msg: string) => void) => listener(successMessage)
		});
		sinon.stub(cp,'spawn').returns(<cp.ChildProcess>process.object);

		let actualCommand: string = undefined;
		let commandStub = sinon.stub(utils, 'executeBufferedCommand').withArgs(sinon.match.any, sinon.match.any,sinon.match.any)
			.returns(Promise.resolve(undefined));

		sinon.stub(fs,'pathExists').withArgs(sinon.match.any,sinon.match.any).returns();
		let removeStub = sinon.stub(fs,'remove').withArgs(sinon.match.any,sinon.match.any).returns();

		// When I call start and then stop
		await serverInstance.start();
		await serverInstance.stop();

		// Then I expect stop to be called on the child process
		actualCommand = commandStub.args[0][0] as string;
		should(actualCommand.includes(`stop ${serverInstance.port}`)).be.true('Command did not contain specified port.');
		sinon.assert.callCount(removeStub,0);
	});

	it('Should remove directory on close', async function (): Promise<void> {
		// Given configure and startup are done
		sinon.stub(utils,'ensureDirSync').withArgs(sinon.match.any,sinon.match.any).returns();
		sinon.stub(fs,'copySync').returns();

		let process = setupSpawn({
			sdtout: (listener: (msg: string) => void) => { },
			stderr: (listener: (msg: string) => void) => listener(successMessage)
		});

		sinon.stub(cp,'spawn').returns(<cp.ChildProcess>process.object);

		sinon.stub(utils, 'executeBufferedCommand').withArgs(sinon.match.any, sinon.match.any,sinon.match.any)
			.returns(Promise.resolve(undefined));

		let pathStub = sinon.stub(fs,'pathExists');
		pathStub.resolves(true);

		let removeStub = sinon.stub(fs,'remove').returns();

		await serverInstance.configure();
		await serverInstance.start();

		// When I call stop
		await serverInstance.stop();

		// Then I expect the directory to be cleaned up
		sinon.assert.callCount(removeStub,1);
	});

	function setupSpawn(callbacks: IProcessCallbacks): TypeMoq.IMock<ChildProcessStub> {

		let stdoutMock = TypeMoq.Mock.ofType(stream.Readable);
		stdoutMock.setup(s => s.on(TypeMoq.It.isValue('data'), TypeMoq.It.isAny()))
			.returns((event, listener) => runIfExists(listener, callbacks.sdtout));
		let stderrMock = TypeMoq.Mock.ofType(stream.Readable);
		stderrMock.setup(s => s.on(TypeMoq.It.isValue('data'), TypeMoq.It.isAny()))
			.returns((event, listener) => runIfExists(listener, callbacks.stderr));
		let mockProcess = TypeMoq.Mock.ofType(ChildProcessStub);
		mockProcess.setup(p => p.stdout).returns(() => stdoutMock.object);
		mockProcess.setup(p => p.stderr).returns(() => stderrMock.object);
		mockProcess.setup(p => p.on(TypeMoq.It.isValue('exit'), TypeMoq.It.isAny()))
			.returns((event, listener) => runIfExists(listener, callbacks.exit));
		mockProcess.setup(p => p.on(TypeMoq.It.isValue('error'), TypeMoq.It.isAny()))
			.returns((event, listener) => runIfExists(listener, callbacks.error));
		mockProcess.setup(p => p.removeListener(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		mockProcess.setup(p => p.addListener(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		return mockProcess;
	}

	function runIfExists(listener: any, callback: Function, delay: number = 5): stream.Readable {
		setTimeout(() => {
			if (callback) {
				callback(listener);
			}
		}, delay);
		return undefined;
	}
});

interface IProcessCallbacks {
	sdtout?: Function;
	stderr?: Function;
	exit?: Function;
	error?: Function;
}

class ChildProcessStub {
	public get stdout(): stream.Readable {
		return undefined;
	}
	public get stderr(): stream.Readable {
		return undefined;
	}
	// tslint:disable-next-line:typedef
	on(event: any, listener: any) {
		throw new Error('Method not implemented.');
	}
	addListener(event: string, listener: Function): void {
		throw new Error('Method not implemented.');
	}
	removeListener(event: string, listener: Function): void {
		throw new Error('Method not implemented.');
	}
}
