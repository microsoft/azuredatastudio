/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

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

// Database password generation
function generatePassword() {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let password = "";
	for (let n = 0; n < 128; n++) {
		password += chars.charAt(Math.random() * chars.length)
	}
	return password;
}

// Environment variable names
const ENVAR_PYTHON_INSTALL_PATH = 'PYTHON_TEST_PATH';
const ENVAR_RUN_PYTHON3_TEST = 'RUN_PYTHON3_TEST';
const ENVAR_SQL_2017_PASS = 'SQL_2017_PASS';
const ENVAR_SQL_2019_PASS = 'SQL_2019_PASS';
const ENVAR_AZURE_SQL_PASS = 'AZURE_SQL_PASS';

// Set the values that are not stored in AKV here
process.env[ENVAR_PYTHON_INSTALL_PATH] = NOTEBOOK_PYTHON_INSTALL_PATH;
process.env[ENVAR_RUN_PYTHON3_TEST] = '1';
process.env[ENVAR_SQL_2017_PASS] = generatePassword();
process.env[ENVAR_SQL_2019_PASS] = generatePassword();
process.env[ENVAR_AZURE_SQL_PASS] = generatePassword();

console.log(`Launching new window: ${LAUNCH_OPTION}...`);
if (LAUNCH_OPTION === LAUNCH_VSCODE) {
	console.warn('Trying to launch vscode, make sure you have it set properly in the PATH environment variable');
}
execSync(LAUNCH_OPTION);
console.log('New window for running test has been opened.');

// Start docker containers
// For windows, we need to run it as an admin to get it working locally, which can only be done using Start-Process
const winargs = ['powershell.exe', '-Command', `Start-Process powershell.exe -ArgumentList '-Command', '$sql2017pass=\\"${process.env[ENVAR_SQL_2017_PASS]}\\";$sql2019pass=\\"${process.env[ENVAR_SQL_2019_PASS]}\\";$azuresqlpass=\\"${process.env[ENVAR_AZURE_SQL_PASS]}\\";${__dirname}\\dockerWindows.ps1' -Verb RunAs`];
const unixargs = ['bash', '-c', `chmod +x ${__dirname}/dockerUnix.sh; export sql2017pass="${process.env[ENVAR_SQL_2017_PASS]}"; export sql2019pass="${process.env[ENVAR_SQL_2019_PASS]}"; export azuresqlpass="${process.env[ENVAR_AZURE_SQL_PASS]}"; ${__dirname}/dockerUnix.sh`];

const args = os.platform() === 'win32' ? winargs : unixargs;

const child = spawn(args[0], args.slice(1));

console.log(`Running docker setup...`);
child.stdout.on('data', (data) => {
	console.log(`${data}`);
});

child.stderr.on('data', (data) => {
	console.error(`${data}`);
});

child.on('close', () => {
	console.log(`Finished running docker setup.`);
});

child.on('error', (error) => {
	console.error(`Error: ${error.message}`);
});
