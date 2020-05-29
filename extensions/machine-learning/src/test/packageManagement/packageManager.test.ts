/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import { PackageManager } from '../../packageManagement/packageManager';
import { createContext, TestContext } from './utils';

describe('Package Manager', () => {
	it('Should initialize SQL package manager successfully', async function (): Promise<void> {
		let testContext = createContext();
		should.doesNotThrow(() => createPackageManager(testContext));
	});

	it('Manage Package command Should execute the command for valid connection', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.serverConfigManager.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(true);});
		testContext.serverConfigManager.setup(x => x.enableExternalScriptConfig(connection)).returns(() => {return Promise.resolve(true);});
		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Manage Package command Should execute the command if r installed', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.serverConfigManager.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(false);});
		testContext.serverConfigManager.setup(x => x.isRInstalled(connection)).returns(() => {return Promise.resolve(true);});
		testContext.serverConfigManager.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(true);});
		testContext.serverConfigManager.setup(x => x.enableExternalScriptConfig(connection)).returns(() => {return Promise.resolve(true);});
		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Manage Package command Should show an error for connection without python installed', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.apiWrapper.setup(x => x.showInfoMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		testContext.serverConfigManager.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(false);});
		testContext.serverConfigManager.setup(x => x.isRInstalled(connection)).returns(() => {return Promise.resolve(false);});
		testContext.serverConfigManager.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(true);});
		testContext.serverConfigManager.setup(x => x.enableExternalScriptConfig(connection)).returns(() => {return Promise.resolve(true);});
		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.showInfoMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Manage Package command Should show an error for no connection', async function (): Promise<void> {
		let testContext = createContext();
		let connection: azdata.connection.ConnectionProfile;
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.apiWrapper.setup(x => x.showInfoMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		testContext.serverConfigManager.setup(x => x.enableExternalScriptConfig(connection)).returns(() => {return Promise.resolve(true);});

		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.showInfoMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('installDependencies Should download sqlmlutils if does not exist', async function (): Promise<void> {
		let testContext = createContext();

		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"},
			{"name":"sqlmlutils","version":"1.1.1"}
		]`;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});

		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve(installedPackages);});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		testContext.httpClient.verify(x => x.download(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());

	});

	it('installDependencies Should not install packages if already installed', async function (): Promise<void> {
		let testContext = createContext();
		let packagesInstalled = false;
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"},
			{"name":"sqlmlutils","version":"1.1.1"}
		]`;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((command) => {
			if (command.indexOf('pip install') > 0) {
				packagesInstalled = true;
			}
			return Promise.resolve(installedPackages);
		});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		should.equal(packagesInstalled, false);
	});

	it('installDependencies Should install packages that are not already installed', async function (): Promise<void> {
		let testContext = createContext();
		let packagesInstalled = false;
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"}
		]`;
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			label: 'Yes'
		}));
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((command) => {
			if (command.indexOf('pip install') > 0) {
				packagesInstalled = true;
			}
			return Promise.resolve(installedPackages);
		});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		should.equal(packagesInstalled, true);
	});

	it('installDependencies Should not install packages if runtime is disabled in setting', async function (): Promise<void> {
		let testContext = createContext();
		testContext.config.setup(x => x.rEnabled).returns(() => false);
		testContext.config.setup(x => x.pythonEnabled).returns(() => false);
		let packagesInstalled = false;
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"}
		]`;
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			label: 'Yes'
		}));
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((command) => {
			if (command.indexOf('pip install') > 0 || command.indexOf('install.packages') > 0) {
				packagesInstalled = true;
			}
			return Promise.resolve(installedPackages);
		});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		should.equal(packagesInstalled, false);
	});

	it('installDependencies Should install packages that have older version installed', async function (): Promise<void> {
		let testContext = createContext();
		let packagesInstalled = false;
		let installedPackages = `[
			{"name":"sqlmlutils","version":"0.1.1"}
		]`;
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			label: 'Yes'
		}));
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((command) => {
			if (command.indexOf('pip install') > 0) {
				packagesInstalled = true;
			}
			return Promise.resolve(installedPackages);
		});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		should.equal(packagesInstalled, true);
	});

	it('installDependencies Should install packages if list packages fails', async function (): Promise<void> {
		let testContext = createContext();
		let packagesInstalled = false;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			label: 'Yes'
		}));

		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((command,) => {
			if (command.indexOf('pip list') > 0) {
				return Promise.reject();
			} else if (command.indexOf('pip install') > 0) {
				packagesInstalled = true;
				return Promise.resolve('');
			} else {
				return Promise.resolve('');
			}
		});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		should.equal(packagesInstalled, true);
	});

	it('installDependencies Should fail if download packages fails', async function (): Promise<void> {
		let testContext = createContext();
		let packagesInstalled = false;
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"}
		]`;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.httpClient.setup(x => x.download(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.reject());
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((command) => {
			if (command.indexOf('pip list') > 0) {
				return Promise.resolve(installedPackages);
			} else if (command.indexOf('pip install') > 0) {
				return Promise.reject();
			} else {
				return Promise.resolve('');
			}
		});

		let packageManager = createPackageManager(testContext);
		await should(packageManager.installDependencies()).rejected();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Failed);
		should.equal(packagesInstalled, false);
	});

	function createPackageManager(testContext: TestContext): PackageManager {
		testContext.config.setup(x => x.requiredSqlPythonPackages).returns( () => [
			{ name: 'pymssql', version: '2.1.4' },
			{ name: 'sqlmlutils', version: '' }
		]);
		testContext.config.setup(x => x.requiredSqlRPackages).returns( () => [
			{ name: 'RODBCext', repository: 'https://cran.microsoft.com' },
			{ name: 'sqlmlutils', fileName: 'sqlmlutils_0.7.1.zip', downloadUrl: 'https://github.com/microsoft/sqlmlutils/blob/master/R/dist/sqlmlutils_0.7.1.zip?raw=true'}
		]);
		testContext.httpClient.setup(x => x.download(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.config.setup(x => x.getPythonExecutable(true)).returns(() => Promise.resolve('python'));
		testContext.config.setup(x => x.getRExecutable(true)).returns(() => Promise.resolve('r'));
		testContext.config.setup(x => x.rEnabled).returns(() => true);
		testContext.config.setup(x => x.pythonEnabled).returns(() => true);
		let packageManager = new PackageManager(
			testContext.outputChannel,
			'',
			testContext.apiWrapper.object,
			testContext.serverConfigManager.object,
			testContext.processService.object,
			testContext.config.object,
			testContext.httpClient.object);
		packageManager.init();
		packageManager.dependenciesInstalled = true;
		return packageManager;
	}
});
