/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as uuid from 'uuid';
import * as fs from 'fs-extra';
import * as utils from '../../common/utils';
import { JupyterServerInstallation, PythonInstallSettings, PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';
import { powershellDisplayName, pysparkDisplayName, python3DisplayName, sparkRDisplayName, sparkScalaDisplayName, winPlatform } from '../../common/constants';

describe('Jupyter Server Installation', function () {
	let outputChannelStub: TypeMoq.IMock<vscode.OutputChannel>;
	let installation: JupyterServerInstallation;

	beforeEach(function (): void {
		outputChannelStub = TypeMoq.Mock.ofType<vscode.OutputChannel>();
		outputChannelStub.setup(c => c.show(TypeMoq.It.isAny()));
		outputChannelStub.setup(c => c.appendLine(TypeMoq.It.isAnyString()));

		installation = new JupyterServerInstallation('', outputChannelStub.object);
		installation.execOptions = { env: Object.assign({}, process.env) };
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Getters and setters', async function() {
		let pythonPath = installation.pythonInstallationPath;
		should(pythonPath).be.equal(JupyterServerInstallation.getPythonInstallPath());
	});

	it('Get pip packages', async function() {
		// Should return nothing if passed an invalid python path
		let fakePath = uuid.v4();
		let pkgResult = await installation.getInstalledPipPackages(fakePath);
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);

		// Should return nothing if python is not installed
		sinon.stub(JupyterServerInstallation, 'isPythonInstalled').returns(false);
		pkgResult = await installation.getInstalledPipPackages();
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);

		// Should return nothing on error
		sinon.restore();
		sinon.stub(JupyterServerInstallation, 'isPythonInstalled').returns(true);
		sinon.stub(utils, 'executeBufferedCommand').rejects(new Error('Expected test failure.'));
		pkgResult = await installation.getInstalledPipPackages();
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);
		outputChannelStub.verify(c => c.appendLine(TypeMoq.It.isAnyString()), TypeMoq.Times.once());

		// Normal use case
		sinon.restore();
		let testPackages: PythonPkgDetails[] = [{
			name: 'TestPkg1',
			version: '1.2.3'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		sinon.stub(JupyterServerInstallation, 'isPythonInstalled').returns(true);
		sinon.stub(utils, 'executeBufferedCommand').resolves(JSON.stringify(testPackages));
		pkgResult = await installation.getInstalledPipPackages();
		should(pkgResult).be.deepEqual(testPackages);
	});

	it('Install pip package', async function() {
		let commandStub = sinon.stub(utils, 'executeStreamedCommand').resolves();

		// Should not execute any commands when passed an empty package list
		await installation.installPipPackages(undefined, false);
		should(commandStub.called).be.false();

		await installation.installPipPackages([], false);
		should(commandStub.called).be.false();

		// Install package using exact version
		let testPackages = [{
			name: 'TestPkg1',
			version: '1.2.3'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await installation.installPipPackages(testPackages, false);
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"TestPkg1==1.2.3" "TestPkg2==4.5.6"')).be.true();

		// Install package using minimum version
		await installation.installPipPackages(testPackages, true);
		should(commandStub.calledTwice).be.true();
		commandStr = commandStub.args[1][0] as string;
		should(commandStr.includes('"TestPkg1>=1.2.3" "TestPkg2>=4.5.6"')).be.true();
	});

	it('Uninstall pip package', async function() {
		let commandStub = sinon.stub(utils, 'executeStreamedCommand').resolves();

		let testPackages = [{
			name: 'jupyter',
			version: '1.0.0'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await installation.uninstallPipPackages(testPackages);
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"jupyter==1.0.0" "TestPkg2==4.5.6"')).be.true();
	});

	it('Get conda packages', async function() {
		// Should return nothing if conda is not installed
		sinon.stub(fs, 'existsSync').returns(false);
		let pkgResult = await installation.getInstalledCondaPackages();
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);

		// Should return nothing on error
		sinon.restore();
		sinon.stub(fs, 'existsSync').returns(true);
		sinon.stub(utils, 'executeBufferedCommand').rejects(new Error('Expected test failure.'));
		pkgResult = await installation.getInstalledCondaPackages();
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);
		outputChannelStub.verify(c => c.appendLine(TypeMoq.It.isAnyString()), TypeMoq.Times.once());

		// Normal use case
		sinon.restore();
		let testPackages: PythonPkgDetails[] = [{
			name: 'TestPkg1',
			version: '1.2.3',
			channel: 'conda'
		}, {
			name: 'TestPkg2',
			version: '4.5.6',
			channel: 'pypi'
		}, {
			name: 'TestPkg3',
			version: '7.8.9',
			channel: 'conda'
		}];
		sinon.stub(fs, 'existsSync').returns(true);
		sinon.stub(utils, 'executeBufferedCommand').resolves(JSON.stringify(testPackages));
		pkgResult = await installation.getInstalledCondaPackages();
		let filteredPackages = testPackages.filter(pkg => pkg.channel !== 'pypi');
		should(pkgResult).be.deepEqual(filteredPackages);
	});

	it('Install conda package', async function() {
		let commandStub = sinon.stub(utils, 'executeStreamedCommand').resolves();

		// Should not execute any commands when passed an empty package list
		await installation.installCondaPackages(undefined, false);
		should(commandStub.called).be.false();

		await installation.installCondaPackages([], false);
		should(commandStub.called).be.false();

		// Install package using exact version
		let testPackages = [{
			name: 'TestPkg1',
			version: '1.2.3'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await installation.installCondaPackages(testPackages, false);
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"TestPkg1==1.2.3" "TestPkg2==4.5.6"')).be.true();

		// Install package using minimum version
		await installation.installCondaPackages(testPackages, true);
		should(commandStub.calledTwice).be.true();
		commandStr = commandStub.args[1][0] as string;
		should(commandStr.includes('"TestPkg1>=1.2.3" "TestPkg2>=4.5.6"')).be.true();
	});

	it('Uninstall conda package', async function() {
		let commandStub = sinon.stub(utils, 'executeStreamedCommand').resolves();

		let testPackages = [{
			name: 'jupyter',
			version: '1.0.0'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await installation.uninstallCondaPackages(testPackages);
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"jupyter==1.0.0" "TestPkg2==4.5.6"')).be.true();
	});

	it('Get required packages test', async function() {
		// Undefined argument
		let packages = installation.getRequiredPackagesForKernel(undefined);
		should(packages).not.be.undefined();
		should(packages.length).be.equal(0);

		// Invalid kernel name
		packages = installation.getRequiredPackagesForKernel('NotARealKernel');
		should(packages).not.be.undefined();
		should(packages.length).be.equal(0);

		// Python 3
		let expectedPackages: PythonPkgDetails[] = [{
			name: 'jupyter',
			version: '1.0.0'
		}];
		packages = installation.getRequiredPackagesForKernel(python3DisplayName);
		should(packages).be.deepEqual(expectedPackages);

		// Powershell
		expectedPackages.push({
			name: 'powershell-kernel',
			version: '0.1.3'
		});
		packages = installation.getRequiredPackagesForKernel(powershellDisplayName);
		should(packages).be.deepEqual(expectedPackages);

		// PySpark
		expectedPackages = [{
			name: 'jupyter',
			version: '1.0.0'
		}, {
			name: 'sparkmagic',
			version: '0.12.9'
		}, {
			name: 'pandas',
			version: '0.24.2'
		}, {
			name: 'prose-codeaccelerator',
			version: '1.3.0'
		}];
		packages = installation.getRequiredPackagesForKernel(pysparkDisplayName);
		should(packages).be.deepEqual(expectedPackages);

		packages = installation.getRequiredPackagesForKernel(sparkScalaDisplayName);
		should(packages).be.deepEqual(expectedPackages);

		packages = installation.getRequiredPackagesForKernel(sparkRDisplayName);
		should(packages).be.deepEqual(expectedPackages);
	});

	it('Install python test', async function() {
		// Should reject overwriting an existing python install if running on Windows and python is currently running.
		if (process.platform === winPlatform) {
			sinon.stub(utils, 'executeBufferedCommand').resolves('python.exe');

			let installSettings: PythonInstallSettings = {
				installPath: `${process.env['USERPROFILE']}\\ads-python`,
				existingPython: false,
				packages: []
			};
			await should(installation.startInstallProcess(false, installSettings)).be.rejected();

			sinon.restore();
		}

		// Install required packages to existing python instance
		let installSettings: PythonInstallSettings = {
			installPath: `${process.env['USERPROFILE']}\\ads-python`,
			existingPython: true,
			packages: installation.getRequiredPackagesForKernel(python3DisplayName)
		};

		sinon.stub(utils, 'exists')
			.onFirstCall().resolves(true) // First call is in configurePackagePaths
			.onSecondCall().resolves(true) // Second call is in installDependencies
			.onThirdCall().rejects(new Error('Unexpected call to utils.exists.'));

		sinon.stub(utils, 'executeBufferedCommand')
			.onFirstCall().resolves(`${installSettings.installPath}\\site-packages`) // Called from getPythonUserDir, which gets called in configurePackagePaths
			.onSecondCall().rejects(new Error('Unexpected call to utils.executeBufferedCommand.'));

		sinon.stub(fs, 'existsSync')
			.onFirstCall().returns(false) // Called from isCondaInstalled, which gets called in configurePackagePaths
			.onSecondCall().rejects(new Error('Unexpected call to fs.existsSync.'));

		// Both of these are called from upgradePythonPackages
		sinon.stub(installation, 'getInstalledPipPackages').resolves([]);
		let pipInstallStub = sinon.stub(installation, 'installPipPackages').resolves();

		await should(installation.startInstallProcess(false, installSettings)).be.resolved();

		should(pipInstallStub.callCount).be.equal(1);

		let packagesToInstall = pipInstallStub.firstCall.args[0] as PythonPkgDetails[];
		should(packagesToInstall).be.deepEqual(installation.getRequiredPackagesForKernel(python3DisplayName));
	});
});
