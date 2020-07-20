/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import { JupyterServerInstallation, PythonPkgDetails, IJupyterServerInstallation, PythonInstallSettings } from '../../jupyter/jupyterServerInstallation';
import { LocalCondaPackageManageProvider } from '../../jupyter/localCondaPackageManageProvider';
import * as constants from '../../common/constants';
import { LocalPipPackageManageProvider } from '../../jupyter/localPipPackageManageProvider';
import { IPyPiClient, PyPiClient } from '../../jupyter/pypiClient';

interface TestContext {
	serverInstallation: IJupyterServerInstallation;
	piPyClient: IPyPiClient;
}

describe('Manage Package Providers', () => {

	it('Conda should return valid package target', async function (): Promise<void> {
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let provider = new LocalCondaPackageManageProvider(serverInstallation.object);
		should.deepEqual(provider.packageTarget, { location: constants.localhostName, packageType: constants.PythonPkgType.Anaconda });
	});

	it('Pip should return valid package target', async function (): Promise<void> {
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let client = createPipyClient(testContext);
		let provider = new LocalPipPackageManageProvider(serverInstallation.object, client.object);
		should.deepEqual(provider.packageTarget, { location: constants.localhostName, packageType: constants.PythonPkgType.Pip });
	});

	it('Pip listPackages should return valid packages', async function (): Promise<void> {
		let packages = [
			{
				name: 'name1',
				version: '1.1.1.1'
			}
		];
		let testContext = createContext();
		testContext.serverInstallation.getInstalledPipPackages = () => {
			return Promise.resolve(packages);
		};
		let serverInstallation = createJupyterServerInstallation(testContext);
		let client = createPipyClient(testContext);
		let provider = new LocalPipPackageManageProvider(serverInstallation.object, client.object);

		should.deepEqual(await provider.listPackages(), packages);
	});

	it('Conda listPackages should return valid packages', async function (): Promise<void> {
		let packages = [
			{
				name: 'name1',
				version: '1.1.1.1'
			}
		];
		let testContext = createContext();
		testContext.serverInstallation.getInstalledCondaPackages = () => {
			return Promise.resolve(packages);
		};
		let serverInstallation = createJupyterServerInstallation(testContext);
		let provider = new LocalCondaPackageManageProvider(serverInstallation.object);

		let actual = await provider.listPackages();
		should.deepEqual(actual, packages);
	});

	it('Pip installPackages should install packages successfully', async function (): Promise<void> {
		let packages = [
			{
				name: 'name1',
				version: '1.1.1.1'
			}
		];
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let client = createPipyClient(testContext);
		let provider = new LocalPipPackageManageProvider(serverInstallation.object, client.object);

		await provider.installPackages(packages, true);
		serverInstallation.verify(x => x.installPipPackages(packages, true), TypeMoq.Times.once());
	});

	it('Conda installPackages should install packages successfully', async function (): Promise<void> {
		let packages = [
			{
				name: 'name1',
				version: '1.1.1.1'
			}
		];
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let provider = new LocalCondaPackageManageProvider(serverInstallation.object);

		await provider.installPackages(packages, true);
		serverInstallation.verify(x => x.installCondaPackages(packages, true), TypeMoq.Times.once());
	});

	it('Pip uninstallPackages should install packages successfully', async function (): Promise<void> {
		let packages = [
			{
				name: 'name1',
				version: '1.1.1.1'
			}
		];
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let client = createPipyClient(testContext);
		let provider = new LocalPipPackageManageProvider(serverInstallation.object, client.object);

		await provider.uninstallPackages(packages);
		serverInstallation.verify(x => x.uninstallPipPackages(packages), TypeMoq.Times.once());
	});

	it('Conda uninstallPackages should install packages successfully', async function (): Promise<void> {
		let packages = [
			{
				name: 'name1',
				version: '1.1.1.1'
			}
		];
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let provider = new LocalCondaPackageManageProvider(serverInstallation.object);

		await provider.uninstallPackages(packages);
		serverInstallation.verify(x => x.uninstallCondaPackages(packages), TypeMoq.Times.once());
	});

	it('Conda canUseProvider should return what the server is returning', async function (): Promise<void> {
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let provider = new LocalCondaPackageManageProvider(serverInstallation.object);

		should.equal(await provider.canUseProvider(), false);
	});

	it('Pip canUseProvider should return true', async function (): Promise<void> {
		let testContext = createContext();
		let serverInstallation = createJupyterServerInstallation(testContext);
		let client = createPipyClient(testContext);
		let provider = new LocalPipPackageManageProvider(serverInstallation.object, client.object);

		should.equal(await provider.canUseProvider(), true);
	});

	it('Pip getPackageOverview should return package info successfully', async function (): Promise<void> {
		let testContext = createContext();
		testContext.piPyClient.fetchPypiPackage = (packageName) => {
			return Promise.resolve(`{"info":{"summary":"package summary"}, "releases":{"0.0.1":[{"comment_text":""}], "0.0.2":[{"comment_text":""}]}}`);
		};
		let serverInstallation = createJupyterServerInstallation(testContext);
		let client = createPipyClient(testContext);
		let provider = new LocalPipPackageManageProvider(serverInstallation.object, client.object);

		await should(provider.getPackageOverview('name')).resolvedWith({
			name: 'name',
			versions: ['0.0.2', '0.0.1'],
			summary: 'package summary'
		});
	});

	it('Conda getPackageOverview should return package info successfully', async function (): Promise<void> {
		let testContext = createContext();
		testContext.serverInstallation.executeBufferedCommand = (command) => {
			return Promise.resolve(`{"name":[{"version":"0.0.1"}, {"version":"0.0.2"}]}`);
		};
		let serverInstallation = createJupyterServerInstallation(testContext);

		let provider = new LocalCondaPackageManageProvider(serverInstallation.object);

		await should(provider.getPackageOverview('name')).resolvedWith({
			name: 'name',
			versions: ['0.0.2', '0.0.1'],
			summary: undefined
		});
	});

	it('Fetch pypi package test', async function (): Promise<void> {
		let pypiClient = new PyPiClient();

		// Fetch a package required by notebooks
		let pkgName = 'jupyter';
		let packageJsonResult = await pypiClient.fetchPypiPackage(pkgName);
		should(packageJsonResult).not.be.undefined();

		let packageInfo = JSON.parse(packageJsonResult);
		should(packageInfo).not.be.undefined();
		should(packageInfo.info).not.be.undefined();
		should(packageInfo.info.name).not.be.undefined();
		should(packageInfo.info.name.toString().toLowerCase()).equal(pkgName);

		// Try to fetch an empty string to ensure retrieval fails
		await should(pypiClient.fetchPypiPackage('')).be.rejected();
	});

	function createContext(): TestContext {
		return {
			serverInstallation: {
				installCondaPackages: (packages: PythonPkgDetails[], useMinVersion: boolean) => { return Promise.resolve(); },
				configurePackagePaths: () => { return Promise.resolve(); },
				startInstallProcess: (forceInstall: boolean, installSettings?: PythonInstallSettings) => { return Promise.resolve(); },
				getInstalledPipPackages: () => { return Promise.resolve([]); },
				installPipPackages: (packages: PythonPkgDetails[], useMinVersion: boolean) => { return Promise.resolve(); },
				uninstallPipPackages: (packages: PythonPkgDetails[]) => { return Promise.resolve(); },
				getInstalledCondaPackages: () => { return Promise.resolve([]); },
				uninstallCondaPackages: (packages: PythonPkgDetails[]) => { return Promise.resolve(); },
				executeBufferedCommand: (command: string) => { return Promise.resolve(''); },
				executeStreamedCommand: (command: string) => { return Promise.resolve(); },
				getCondaExePath: () => { return ''; },
				pythonExecutable:  '',
				pythonInstallationPath: '',
				usingConda: false,
				installPythonPackage: (backgroundOperation: azdata.BackgroundOperation, usingExistingPython: boolean, pythonInstallationPath: string, outputChannel: vscode.OutputChannel) => {return Promise.resolve(); }
			},
			piPyClient: {
				fetchPypiPackage: (packageName) => { return Promise.resolve(); }
			}
		};
	}

	function createJupyterServerInstallation(testContext: TestContext): TypeMoq.IMock<JupyterServerInstallation> {
		let mockInstance = TypeMoq.Mock.ofType(JupyterServerInstallation);
		mockInstance.setup(x => x.installCondaPackages(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((packages, useMinVersion) => testContext.serverInstallation.installCondaPackages(packages, useMinVersion));
		mockInstance.setup(x => x.installPipPackages(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((packages, useMinVersion) => testContext.serverInstallation.installPipPackages(packages, useMinVersion));
		mockInstance.setup(x => x.uninstallCondaPackages(TypeMoq.It.isAny())).returns((packages, useMinVersion) => testContext.serverInstallation.uninstallCondaPackages(packages));
		mockInstance.setup(x => x.uninstallPipPackages(TypeMoq.It.isAny())).returns((packages, useMinVersion) => testContext.serverInstallation.uninstallPipPackages(packages));
		mockInstance.setup(x => x.getInstalledPipPackages()).returns(() => testContext.serverInstallation.getInstalledPipPackages());
		mockInstance.setup(x => x.getInstalledCondaPackages()).returns(() => testContext.serverInstallation.getInstalledCondaPackages());
		mockInstance.setup(x => x.executeBufferedCommand(TypeMoq.It.isAny())).returns((command) => testContext.serverInstallation.executeBufferedCommand(command));
		mockInstance.setup(x => x.usingConda).returns(() => testContext.serverInstallation.usingConda);
		return mockInstance;
	}

	function createPipyClient(testContext: TestContext): TypeMoq.IMock<IPyPiClient> {
		let mockInstance = TypeMoq.Mock.ofType(PyPiClient);
		mockInstance.setup(x => x.fetchPypiPackage(TypeMoq.It.isAny())).returns((packageName) =>
			testContext.piPyClient.fetchPypiPackage(packageName));
		return mockInstance;
	}
});
