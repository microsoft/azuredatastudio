/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import 'mocha';

import { JupyterController } from '../jupyter/jupyterController';
import { JupyterServerInstallation, PythonPkgDetails } from '../jupyter/jupyterServerInstallation';
import { pythonBundleVersion } from '../common/constants';
import { executeStreamedCommand, sortPackageVersions } from '../common/utils';

describe('Notebook Extension Python Installation', function () {
	this.timeout(600000);

	let installComplete = false;
	let pythonInstallDir = process.env.PYTHON_TEST_PATH;
	let jupyterController: JupyterController;

	before(async function () {
		assert.ok(pythonInstallDir, 'Python install directory was not defined.');

		let notebookExtension: vscode.Extension<any>;
		while (true) {
			notebookExtension = vscode.extensions.getExtension('Microsoft.notebook');
			if (notebookExtension && notebookExtension.isActive) {
				console.log('Microsoft.notebook is active');
				break;
			} else {
				console.log('Microsoft.notebook is not active');
				await new Promise(resolve => { setTimeout(resolve, 1000); });
			}
		}

		jupyterController = notebookExtension.exports.getJupyterController() as JupyterController;

		console.log('Start Jupyter Installation');
		await jupyterController.jupyterInstallation.startInstallProcess(false, { installPath: pythonInstallDir, existingPython: false });
		installComplete = true;
		console.log('Jupyter Installation is done');
	});

	it('Verify Python Installation', async function () {
		should(installComplete).be.true('Python setup did not complete.');
		let jupyterPath = JupyterServerInstallation.getPythonInstallPath();

		console.log(`Expected python path: '${pythonInstallDir}'; actual: '${jupyterPath}'`);
		should(jupyterPath).be.equal(pythonInstallDir);
		should(JupyterServerInstallation.isPythonInstalled()).be.true();
		should(JupyterServerInstallation.getExistingPythonSetting()).be.false();
	});

	it('Use Existing Python Installation', async function () {
		should(installComplete).be.true('Python setup did not complete.');

		console.log('Uninstalling existing pip dependencies');
		let install = jupyterController.jupyterInstallation;
		let pythonExe = JupyterServerInstallation.getPythonExePath(pythonInstallDir, false);
		let command = `"${pythonExe}" -m pip uninstall -y jupyter pandas sparkmagic prose-codeaccelerator`;
		await executeStreamedCommand(command, { env: install.execOptions.env }, install.outputChannel);
		console.log('Uninstalling existing pip dependencies is done');

		console.log('Start Existing Python Installation');
		let existingPythonPath = path.join(pythonInstallDir, pythonBundleVersion);
		await install.startInstallProcess(false, { installPath: existingPythonPath, existingPython: true });
		should(JupyterServerInstallation.isPythonInstalled()).be.true();
		should(JupyterServerInstallation.getPythonInstallPath()).be.equal(existingPythonPath);
		should(JupyterServerInstallation.getExistingPythonSetting()).be.true();

		// Redo "new" install to restore original settings.
		// The actual install should get skipped since it already exists.
		await install.startInstallProcess(false, { installPath: pythonInstallDir, existingPython: false });
		should(JupyterServerInstallation.isPythonInstalled()).be.true();
		should(JupyterServerInstallation.getPythonInstallPath()).be.equal(pythonInstallDir);
		should(JupyterServerInstallation.getExistingPythonSetting()).be.false();
		console.log('Existing Python Installation is done');
	});

	it('Pip Install Utilities Test', async function () {
		let install = jupyterController.jupyterInstallation;

		let testPkg = 'pandas';
		let testPkgVersion = '0.24.2';
		let expectedPkg: PythonPkgDetails = { name: testPkg, version: testPkgVersion };

		await install.installPipPackages([{ name: testPkg, version: testPkgVersion}], false);
		let packages = await install.getInstalledPipPackages();
		should(packages).containEql(expectedPkg);

		await install.uninstallPipPackages([{ name: testPkg, version: testPkgVersion}]);
		packages = await install.getInstalledPipPackages();
		should(packages).not.containEql(expectedPkg);

		await install.installPipPackages([{ name: testPkg, version: testPkgVersion}], false);
		packages = await install.getInstalledPipPackages();
		should(packages).containEql(expectedPkg);
	});

	it('Conda Install Utilities Test', async function () {
		let install = jupyterController.jupyterInstallation;

		// Anaconda is not included in our Python package, so all
		// the conda utilities should fail.
		should(install.usingConda).be.false();

		await should(install.getInstalledCondaPackages()).be.rejected();

		await should(install.installCondaPackages([{ name: 'pandas', version: '0.24.2' }], false)).be.rejected();

		await should(install.uninstallCondaPackages([{ name: 'pandas', version: '0.24.2' }])).be.rejected();
	});

	it('Manage Packages Dialog: Sort Versions Test', async function () {
		let testVersions = ['1.0.0', '1.1', '0.0.0.9', '0.0.5', '100', '0.3', '3'];
		let ascendingVersions = ['0.0.0.9', '0.0.5', '0.3', '1.0.0', '1.1', '3', '100'];
		let descendingVersions = ['100', '3', '1.1', '1.0.0', '0.3', '0.0.5', '0.0.0.9'];

		let actualVersions = sortPackageVersions(testVersions);
		should(actualVersions).be.deepEqual(ascendingVersions);

		actualVersions = sortPackageVersions(testVersions, true);
		should(actualVersions).be.deepEqual(ascendingVersions);

		actualVersions = sortPackageVersions(testVersions, false);
		should(actualVersions).be.deepEqual(descendingVersions);
	});
});
