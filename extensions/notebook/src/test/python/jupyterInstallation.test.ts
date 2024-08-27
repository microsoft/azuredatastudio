/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as uuid from 'uuid';
import * as utils from '../../common/utils';
import { JupyterServerInstallation, PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';
import { allKernelsName, ipykernelDisplayName, powershellDisplayName, python3DisplayName } from '../../common/constants';
import { requiredJupyterPackages } from '../../jupyter/requiredJupyterPackages';

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

	it('Getters and setters', async function () {
		let pythonPath = installation.pythonInstallationPath;
		should(pythonPath).be.equal(JupyterServerInstallation.getPythonInstallPath());
	});

	it('Get pip packages', async function () {
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

	it('Install pip package', async function () {
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

	it('Uninstall pip package', async function () {
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

	it('Get conda packages', async function () {
		// Should return nothing if conda is not installed
		sinon.stub(installation, 'condaExecutable').get(() => undefined);
		let pkgResult = await installation.getInstalledCondaPackages();
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);

		// Should return nothing on error
		sinon.restore();
		sinon.stub(installation, 'condaExecutable').get(() => 'TestCondaPath');
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
		sinon.stub(installation, 'condaExecutable').get(() => 'TestCondaPath');
		sinon.stub(utils, 'executeBufferedCommand').resolves(JSON.stringify(testPackages));
		pkgResult = await installation.getInstalledCondaPackages();
		let filteredPackages = testPackages.filter(pkg => pkg.channel !== 'pypi');
		should(pkgResult).be.deepEqual(filteredPackages);
	});

	it('Install conda package', async function () {
		const testPackages = [{
			name: 'TestPkg1',
			version: '1.2.3'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		let commandStub = sinon.stub(utils, 'executeStreamedCommand').resolves();

		// Should not execute any commands if conda is not installed
		let condaStub = sinon.stub(installation, 'condaExecutable').get(() => undefined);
		await installation.installCondaPackages(testPackages, false);
		should(commandStub.called).be.false();

		condaStub.restore();
		sinon.stub(installation, 'condaExecutable').get(() => 'TestCondaPath');

		// Should not execute any commands when passed an empty package list
		await installation.installCondaPackages(undefined, false);
		should(commandStub.called).be.false();

		await installation.installCondaPackages([], false);
		should(commandStub.called).be.false();

		// Install package using exact version
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

	it('Uninstall conda package', async function () {
		sinon.stub(installation, 'condaExecutable').get(() => 'TestCondaPath');
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

	it('Get required packages test - Undefined argument', async function () {
		let packages = installation.getRequiredPackagesForKernel(undefined);
		should(packages).not.be.undefined();
		should(packages.length).be.equal(0);
	});

	it('Get required packages test - Fake kernel', async function () {
		let packages = installation.getRequiredPackagesForKernel('NotARealKernel');
		should(packages).not.be.undefined();
		should(packages.length).be.equal(0);
	});

	const pythonKernels = [python3DisplayName, ipykernelDisplayName, powershellDisplayName];
	pythonKernels.forEach(kernelName => {
		it(`Get required packages test - ${kernelName} kernel`, async function () {
			let packages = installation.getRequiredPackagesForKernel(kernelName);
			let kernelInfo = requiredJupyterPackages.kernels.find(kernel => kernel.name === kernelName);
			should(kernelInfo).not.be.undefined();
			let expectedPackages = requiredJupyterPackages.sharedPackages.concat(kernelInfo.packages);
			should(packages).be.deepEqual(expectedPackages);
		});
	});

	it('Get required packages test - All Kernels', async function () {
		let packages = installation.getRequiredPackagesForKernel(allKernelsName);
		let allPackages = requiredJupyterPackages.sharedPackages;
		for (let kernel of requiredJupyterPackages.kernels) {
			allPackages = allPackages.concat(kernel.packages);
		}
		should(packages).be.deepEqual(allPackages);
	});
});
