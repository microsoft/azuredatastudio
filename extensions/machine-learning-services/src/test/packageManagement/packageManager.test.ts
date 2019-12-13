/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';

import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import { PackageManager } from '../../packageManagement/packageManager';
import { SqlPythonPackageManageProvider } from '../../packageManagement/sqlPackageManageProvider';
import { createContext, TestContext } from './utils';

describe('Package Manager', () => {
	it('Should initialize SQL package manager successfully', async function (): Promise<void> {
		let testContext = createContext();
		should.doesNotThrow(() => createPackageManager(testContext));
		should.equal(testContext.nbExtensionApis.getPackageManagers().has(SqlPythonPackageManageProvider.ProviderId), true);
	});

	it('Manage Package command Should execute the command for valid connection', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.queryRunner.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(true);});
		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Manage Package command Should show an error for connection without python installed', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.apiWrapper.setup(x => x.showInfoMessage(TypeMoq.It.isAny()));
		testContext.queryRunner.setup(x => x.isPythonInstalled(connection)).returns(() => {return Promise.resolve(false);});
		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.showInfoMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Manage Package command Should show an error for no connection', async function (): Promise<void> {
		let testContext = createContext();
		let connection: azdata.connection.ConnectionProfile;
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => {return Promise.resolve(connection);});
		testContext.apiWrapper.setup(x => x.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve();});
		testContext.apiWrapper.setup(x => x.showInfoMessage(TypeMoq.It.isAny()));

		let packageManager = createPackageManager(testContext);
		await packageManager.managePackages();
		testContext.apiWrapper.verify(x => x.showInfoMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('installDependencies Should install python if does not exist', async function (): Promise<void> {
		let testContext = createContext();
		let pythonInstalled = false;
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"},
			{"name":"sqlmlutils","version":"1.1.1"}
		]`;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.jupyterInstallation.installPythonPackage = ()  => {
			pythonInstalled = true;
			return Promise.resolve();
		};
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve(installedPackages);});

		let packageManager = createPackageManager(testContext);
		await packageManager.installDependencies();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Succeeded);
		should.equal(pythonInstalled, true);
	});

	it('installDependencies Should fail the task if installing python fails', async function (): Promise<void> {
		let testContext = createContext();
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"},
			{"name":"sqlmlutils","version":"1.1.1"}
		]`;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.jupyterInstallation.installPythonPackage = ()  => {
			return Promise.reject();
		};
		testContext.processService.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {return Promise.resolve(installedPackages);});

		let packageManager = createPackageManager(testContext);
		await should(packageManager.installDependencies()).rejected();
		should.equal(testContext.getOpStatus(), azdata.TaskStatus.Failed);
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
		testContext.jupyterInstallation.installPythonPackage = ()  => {
			return Promise.resolve();
		};
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
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.jupyterInstallation.installPythonPackage = ()  => {
			return Promise.resolve();
		};
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
		testContext.jupyterInstallation.installPythonPackage = ()  => {
			return Promise.resolve();
		};
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

	it('installDependencies Should fail if install packages fails', async function (): Promise<void> {
		let testContext = createContext();
		let packagesInstalled = false;
		let installedPackages = `[
			{"name":"pymssql","version":"2.1.4"}
		]`;
		testContext.apiWrapper.setup(x => x.startBackgroundOperation(TypeMoq.It.isAny())).returns((operationInfo: azdata.BackgroundOperationInfo) => {
			operationInfo.operation(testContext.op);
		});
		testContext.jupyterInstallation.installPythonPackage = ()  => {
			return Promise.resolve();
		};
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
		testContext.config.setup(x => x.requiredPythonPackages).returns( () => [
			{ name: 'pymssql', version: '2.1.4' },
			{ name: 'sqlmlutils', version: '' }
		]);
		let packageManager = new PackageManager(
			testContext.nbExtensionApis,
			testContext.outputChannel,
			'',
			testContext.apiWrapper.object,
			testContext.queryRunner.object,
			testContext.processService.object,
			testContext.config.object);
		packageManager.init();
		return packageManager;
	}
});


