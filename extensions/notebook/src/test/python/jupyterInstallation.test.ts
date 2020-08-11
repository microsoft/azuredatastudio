/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as uuid from 'uuid';
import { JupyterServerInstallation, PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';

describe('Jupyter Server Installation', function () {
	let outputChannelStub: TypeMoq.IMock<vscode.OutputChannel>;
	let installation: JupyterServerInstallation;

	beforeEach(function (): void {
		outputChannelStub = TypeMoq.Mock.ofType<vscode.OutputChannel>();
		outputChannelStub.setup(c => c.show(TypeMoq.It.isAny()));
		outputChannelStub.setup(c => c.appendLine(TypeMoq.It.isAnyString()));

		installation = new JupyterServerInstallation('', outputChannelStub.object);
	});

	afterEach(function (): void {
		sinon.restore();
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
		sinon.stub(installation, 'executeBufferedCommand').rejects(new Error('Expected test failure.'));
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
		sinon.stub(installation, 'executeBufferedCommand').resolves(JSON.stringify(testPackages));
		pkgResult = await installation.getInstalledPipPackages();
		should(pkgResult).be.deepEqual(testPackages);
	});

	it('Install pip package', async function() {
		let commandStub = sinon.stub(installation, 'executeStreamedCommand').resolves();

		// Should not execute any commands when passed an empty package list
		await should(installation.installPipPackages(undefined, false)).be.resolved();
		should(commandStub.called).be.false();

		await should(installation.installPipPackages([], false)).be.resolved();
		should(commandStub.called).be.false();

		// Install package using exact version
		let testPackages = [{
			name: 'TestPkg1',
			version: '1.2.3'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await should(installation.installPipPackages(testPackages, false)).be.resolved();
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"TestPkg1==1.2.3" "TestPkg2==4.5.6"')).be.true();

		// Install package using minimum version
		await should(installation.installPipPackages(testPackages, true)).be.resolved();
		should(commandStub.calledTwice).be.true();
		commandStr = commandStub.args[1][0] as string;
		should(commandStr.includes('"TestPkg1>=1.2.3" "TestPkg2>=4.5.6"')).be.true();
	});

	it('Uninstall pip package', async function() {
		let commandStub = sinon.stub(installation, 'executeStreamedCommand').resolves();

		let testPackages = [{
			name: 'jupyter',
			version: '1.0.0'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await should(installation.uninstallPipPackages(testPackages)).be.resolved();
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"jupyter==1.0.0" "TestPkg2==4.5.6"')).be.true();
	});

	it('Get conda packages', async function() {
		// Should return nothing if conda is not installed
		sinon.stub(installation, 'isCondaInstalled').returns(false);
		let pkgResult = await installation.getInstalledCondaPackages();
		should(pkgResult).not.be.undefined();
		should(pkgResult.length).be.equal(0);

		// Should return nothing on error
		sinon.restore();
		sinon.stub(installation, 'isCondaInstalled').returns(true);
		sinon.stub(installation, 'executeBufferedCommand').rejects(new Error('Expected test failure.'));
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
		sinon.stub(installation, 'isCondaInstalled').returns(true);
		sinon.stub(installation, 'executeBufferedCommand').resolves(JSON.stringify(testPackages));
		pkgResult = await installation.getInstalledCondaPackages();
		let filteredPackages = testPackages.filter(pkg => pkg.channel !== 'pypi');
		should(pkgResult).be.deepEqual(filteredPackages);
	});

	it('Install conda package', async function() {
		let commandStub = sinon.stub(installation, 'executeStreamedCommand').resolves();

		// Should not execute any commands when passed an empty package list
		await should(installation.installCondaPackages(undefined, false)).be.resolved();
		should(commandStub.called).be.false();

		await should(installation.installCondaPackages([], false)).be.resolved();
		should(commandStub.called).be.false();

		// Install package using exact version
		let testPackages = [{
			name: 'TestPkg1',
			version: '1.2.3'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await should(installation.installCondaPackages(testPackages, false)).be.resolved();
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"TestPkg1==1.2.3" "TestPkg2==4.5.6"')).be.true();

		// Install package using minimum version
		await should(installation.installCondaPackages(testPackages, true)).be.resolved();
		should(commandStub.calledTwice).be.true();
		commandStr = commandStub.args[1][0] as string;
		should(commandStr.includes('"TestPkg1>=1.2.3" "TestPkg2>=4.5.6"')).be.true();
	});

	it('Uninstall conda package', async function() {
		let commandStub = sinon.stub(installation, 'executeStreamedCommand').resolves();

		let testPackages = [{
			name: 'jupyter',
			version: '1.0.0'
		}, {
			name: 'TestPkg2',
			version: '4.5.6'
		}];
		await should(installation.uninstallCondaPackages(testPackages)).be.resolved();
		should(commandStub.calledOnce).be.true();
		let commandStr = commandStub.args[0][0] as string;
		should(commandStr.includes('"jupyter==1.0.0" "TestPkg2==4.5.6"')).be.true();
	});
});
