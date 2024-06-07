/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec, execSync } = require('child_process');

/**
 * Launch options
 * This script will launch a new process with environment variables required to run the test cases
 * below are launch options, feel free to contribute new options here
 */
const LAUNCH_TERMINAL_WINDOWS = 'start cmd.exe';
const LAUNCH_TERMINAL_MAC = 'open -a Terminal -n';
const LAUNCH_GIT_BASH_WINDOWS = 'C:\\Program Files\\Git\\git-bash.exe';
const LAUNCH_VSCODE = 'code';

let LAUNCH_OPTION;

// Parse the command-line argument
if (process.argv.length === 3 && process.argv[2]) {
	const argValue = process.argv[2];
	switch (argValue.toUpperCase()) {
		case 'TERMINAL':
			if (os.platform() === 'win32') {
				LAUNCH_OPTION = LAUNCH_TERMINAL_WINDOWS;
			} else if (os.platform() === 'darwin') {
				LAUNCH_OPTION = LAUNCH_TERMINAL_MAC;
			} else {
				console.warn(`Launch terminal option is not implemented for your os: ${os.platform()}, vscode will be launched`);
			}
			break;
		case 'BASHWIN':
			if (!fs.existsSync(LAUNCH_GIT_BASH_WINDOWS)) {
				throw `Not able to find git-bash.exe in its default location: ${LAUNCH_GIT_BASH_WINDOWS}, please update the variable LAUNCH_GIT_BASH_WINDOWS accordingly.`;
			}
			let bashPath = LAUNCH_GIT_BASH_WINDOWS;
			// quote the path with double quote if it contains spaces
			if (bashPath.indexOf(' ') !== -1) {
				bashPath = '"' + bashPath + '"';
			}

			LAUNCH_OPTION = bashPath;
			break;
		default:
			break;
	}
}

if (!LAUNCH_OPTION) {
	LAUNCH_OPTION = LAUNCH_VSCODE;
}


/**
 * Below are the environment variable values that are not saved in AKV and might vary by machine
 */

// Python for Notebooks
// This environment variable is required by notebook tests.
// How to install it:
// Open ADS and run command 'Configure Python for Notebooks' command and install it to the default folder,
// if you install it to a different folder you will have to update the value of this variable
const NOTEBOOK_PYTHON_INSTALL_PATH = path.join(os.homedir(), 'azuredatastudio-python');

/**
 * ----------------------------------------------------------------------------------------------
 * You *DON'T* need to change the code below if you just need to run the integration tests.
 * ----------------------------------------------------------------------------------------------
 */

// Environment variable value validation
if (!fs.existsSync(NOTEBOOK_PYTHON_INSTALL_PATH)) {
	const message = 'the specified Python install path does not exist.'
		+ os.EOL
		+ 'if you have installed it, please update the NOTEBOOK_PYTHON_INSTALL_PATH variable in this script,'
		+ os.EOL
		+ 'otherwise, please open Azure Data Studio and run "Configure Python for Notebooks" command and install it to the default folder.';
	throw message;
}

// Environment variable names
const ENVAR_PYTHON_INSTALL_PATH = 'PYTHON_TEST_PATH';
const ENVAR_RUN_PYTHON3_TEST = 'RUN_PYTHON3_TEST';

// Set the values that are not stored in AKV here
process.env[ENVAR_PYTHON_INSTALL_PATH] = NOTEBOOK_PYTHON_INSTALL_PATH;
process.env[ENVAR_RUN_PYTHON3_TEST] = '1';

// run the docker.ps1 powershell script, and wait for it to finish
// show all output from the command
const command = `powershell.exe -Command "Start-Process powershell.exe -ArgumentList '-Command \\"${__dirname}\\dockerInstall.ps1\\"' -Verb RunAs"`;

// wait for exec and it's child processes to finish
exec(command, (error, stderr) => {
	if (error) {
		console.error(`Error: ${error.message}`);
		return;
	}
	if (stderr) {
		console.error(`Stderr: ${stderr}`);
		return;
	}
});

console.log(`Running docker setup.`);

console.log(`Launching new window: ${LAUNCH_OPTION}...`);
if (LAUNCH_OPTION === LAUNCH_VSCODE) {
	console.warn('Trying to launch vscode, make sure you have it set properly in the PATH environment variable');
}
execSync(LAUNCH_OPTION);
console.log('New window for running test has been opened.');
