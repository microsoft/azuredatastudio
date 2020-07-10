/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as stream from 'stream';
import { ChildProcess } from 'child_process';
import 'mocha';

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { PerFolderServerInstance, ServerInstanceUtils } from '../../jupyter/serverInstance';
import { MockOutputChannel } from '../common/stubs';
import * as testUtils from '../common/testUtils';
import { LocalJupyterServerManager } from '../../jupyter/jupyterServerManager';

const successMessage = `[I 14:00:38.811 NotebookApp] The Jupyter Notebook is running at:
[I 14:00:38.812 NotebookApp] http://localhost:8891/?token=...
[I 14:00:38.812 NotebookApp] Use Control-C to stop this server and shut down all kernels (twice to skip confirmation).
`;

describe('Jupyter server instance', function (): void {
	let expectedPath = 'mydir/notebook.ipynb';
	let mockInstall: TypeMoq.IMock<JupyterServerInstallation>;
	let mockOutputChannel: TypeMoq.IMock<MockOutputChannel>;
	let mockUtils: TypeMoq.IMock<ServerInstanceUtils>;
	let serverInstance: PerFolderServerInstance;

	beforeEach(() => {
		mockInstall = TypeMoq.Mock.ofType(JupyterServerInstallation, undefined, undefined, '/root');
		mockOutputChannel = TypeMoq.Mock.ofType(MockOutputChannel);
		mockInstall.setup(i => i.outputChannel).returns(() => mockOutputChannel.object);
		mockInstall.setup(i => i.pythonExecutable).returns(() => 'python3');
		mockInstall.object.execOptions = { env: Object.assign({}, process.env) };
		mockUtils = TypeMoq.Mock.ofType(ServerInstanceUtils);
		mockUtils.setup(u => u.ensureProcessEnded(TypeMoq.It.isAny())).returns(() => undefined);
		serverInstance = new PerFolderServerInstance({
			documentPath: expectedPath,
			install: mockInstall.object
		}, mockUtils.object);
	});


	it('Should not be started initially', function (): void {
		// Given a new instance It should not be started
		should(serverInstance.isStarted).be.false();
		should(serverInstance.port).be.undefined();
	});

	it('Should create config and data directories on configure', async function (): Promise<void> {
		// Given a server instance
		mockUtils.setup(u => u.mkDir(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		mockUtils.setup(u => u.copy(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => Promise.resolve());
		mockUtils.setup(u => u.exists(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(false));

		// When I run configure
		await serverInstance.configure();

		// Then I expect a folder to have been created with config and data subdirs
		mockUtils.verify(u => u.mkDir(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(5));
		mockUtils.verify(u => u.copy(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(3));
		mockUtils.verify(u => u.exists(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(1));
	});

	it('Should have URI info after start', async function (): Promise<void> {
		// Given startup will succeed
		let process = setupSpawn({
			sdtout: (listener: (msg: string) => void) => { },
			stderr: (listener: (msg: string) => void) => listener(successMessage)
		});
		mockUtils.setup(u => u.spawn(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => <ChildProcess>process.object);

		// When I call start
		await serverInstance.start();

		// Then I expect all parts of the URI to be defined
		should(serverInstance.uri).not.be.undefined();
		should(serverInstance.uri.scheme).equal('http');
		let settings = LocalJupyterServerManager.getLocalConnectionSettings(serverInstance.uri);
		// Verify a token with expected length was generated
		should(settings.token).have.length(48);
		let hostAndPort = serverInstance.uri.authority.split(':');
		// verify port was set as expected
		should(hostAndPort[1]).length(4);

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
		mockUtils.setup(u => u.spawn(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => <ChildProcess>process.object);

		// When I call start then I expect it to pass
		await serverInstance.start();
	});

	it('Should throw if exit before startup', async function (): Promise<void> {
		let code = -1234;
		let process = setupSpawn({
			exit: (listener: (msg: string | number) => void) => listener(code)
		});
		mockUtils.setup(u => u.spawn(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => <ChildProcess>process.object);

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
		mockUtils.setup(u => u.spawn(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => <ChildProcess>process.object);

		let actualCommand: string = undefined;
		mockUtils.setup(u => u.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns((cmd) => {
				actualCommand = cmd;
				return Promise.resolve(undefined);
			});
		mockUtils.setup(u => u.pathExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
		mockUtils.setup(u => u.removeDir(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		// When I call start and then stop
		await serverInstance.start();
		await serverInstance.stop();

		// Then I expect stop to be called on the child process
		should(actualCommand.includes(`stop ${serverInstance.port}`)).be.true('Command did not contain specified port.');
		mockUtils.verify(u => u.removeDir(TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	it('Should remove directory on close', async function (): Promise<void> {
		// Given configure and startup are done
		mockUtils.setup(u => u.mkDir(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		mockUtils.setup(u => u.copy(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => Promise.resolve());

		let process = setupSpawn({
			sdtout: (listener: (msg: string) => void) => { },
			stderr: (listener: (msg: string) => void) => listener(successMessage)
		});
		mockUtils.setup(u => u.spawn(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns(() => <ChildProcess>process.object);
		mockUtils.setup(u => u.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns((cmd) => Promise.resolve(undefined));
		mockUtils.setup(u => u.pathExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
		mockUtils.setup(u => u.removeDir(TypeMoq.It.isAny())).returns(() => Promise.resolve());

		await serverInstance.configure();
		await serverInstance.start();

		// When I call stop
		await serverInstance.stop();

		// Then I expect the directory to be cleaned up
		mockUtils.verify(u => u.removeDir(TypeMoq.It.isAny()), TypeMoq.Times.once());
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
