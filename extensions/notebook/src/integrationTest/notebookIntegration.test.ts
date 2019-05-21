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
import JupyterServerInstallation from '../jupyter/jupyterServerInstallation';
import { pythonBundleVersion } from '../common/constants';
import { executeStreamedCommand } from '../common/utils';

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
		let jupyterPath = JupyterServerInstallation.getPythonInstallPath(jupyterController.jupyterInstallation.apiWrapper);
		console.log(`Expected python path: '${pythonInstallDir}'; actual: '${jupyterPath}'`);
		should(jupyterPath).be.equal(pythonInstallDir);
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
		console.log('Existing Python Installation is done');
	});
});
