/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require('path');
const os = require('os');
const fs = require('fs');

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

const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const child_process = require('child_process');

// Name of the values that are stored in Azure Key Vault
const AKV_URL = 'https://sqltoolssecretstore.vault.azure.net/';
const SECRET_AZURE_SERVER = 'ads-integration-test-azure-server';
const SECRET_AZURE_SERVER_USERNAME = 'ads-integration-test-azure-server-username';
const SECRET_AZURE_SERVER_PASSWORD = 'ads-integration-test-azure-server-password';
const SECRET_BDC_SERVER = 'ads-integration-test-bdc-server';
const SECRET_BDC_SERVER_USERNAME = 'ads-integration-test-bdc-server-username';
const SECRET_BDC_SERVER_PASSWORD = 'ads-integration-test-bdc-server-password';
const SECRET_STANDALONE_SERVER = 'ads-integration-test-standalone-server';
const SECRET_STANDALONE_SERVER_USERNAME = 'ads-integration-test-standalone-server-username';
const SECRET_STANDALONE_SERVER_PASSWORD = 'ads-integration-test-standalone-server-password';
const SECRET_STANDALONE_SERVER_2019 = 'ads-integration-test-standalone-server-2019';
const SECRET_STANDALONE_SERVER_USERNAME_2019 = 'ads-integration-test-standalone-server-username-2019';
const SECRET_STANDALONE_SERVER_PASSWORD_2019 = 'ads-integration-test-standalone-server-password-2019';

// Environment variable names
const ENVAR_AZURE_SERVER = 'AZURE_SQL';
const ENVAR_AZURE_SERVER_USERNAME = 'AZURE_SQL_USERNAME';
const ENVAR_AZURE_SERVER_PASSWORD = 'AZURE_SQL_PWD';
const ENVAR_BDC_SERVER = 'BDC_BACKEND_HOSTNAME';
const ENVAR_BDC_SERVER_USERNAME = 'BDC_BACKEND_USERNAME';
const ENVAR_BDC_SERVER_PASSWORD = 'BDC_BACKEND_PWD';
const ENVAR_STANDALONE_SERVER = 'STANDALONE_SQL';
const ENVAR_STANDALONE_SERVER_USERNAME = 'STANDALONE_SQL_USERNAME';
const ENVAR_STANDALONE_SERVER_PASSWORD = 'STANDALONE_SQL_PWD';
const ENVAR_STANDALONE_SERVER_2019 = 'STANDALONE_SQL_2019';
const ENVAR_STANDALONE_SERVER_USERNAME_2019 = 'STANDALONE_SQL_USERNAME_2019';
const ENVAR_STANDALONE_SERVER_PASSWORD_2019 = 'STANDALONE_SQL_PWD_2019';
const ENVAR_PYTHON_INSTALL_PATH = 'PYTHON_TEST_PATH';
const ENVAR_RUN_PYTHON3_TEST = 'RUN_PYTHON3_TEST';
const ENVAR_RUN_PYSPARK_TEST = 'RUN_PYSPARK_TEST';

// Mapping between AKV secret and the environment variable names
const SecretEnVarMapping = [];
SecretEnVarMapping.push([SECRET_AZURE_SERVER, ENVAR_AZURE_SERVER]);
SecretEnVarMapping.push([SECRET_AZURE_SERVER_PASSWORD, ENVAR_AZURE_SERVER_PASSWORD]);
SecretEnVarMapping.push([SECRET_AZURE_SERVER_USERNAME, ENVAR_AZURE_SERVER_USERNAME]);
SecretEnVarMapping.push([SECRET_BDC_SERVER, ENVAR_BDC_SERVER]);
SecretEnVarMapping.push([SECRET_BDC_SERVER_PASSWORD, ENVAR_BDC_SERVER_PASSWORD]);
SecretEnVarMapping.push([SECRET_BDC_SERVER_USERNAME, ENVAR_BDC_SERVER_USERNAME]);
SecretEnVarMapping.push([SECRET_STANDALONE_SERVER, ENVAR_STANDALONE_SERVER]);
SecretEnVarMapping.push([SECRET_STANDALONE_SERVER_PASSWORD, ENVAR_STANDALONE_SERVER_PASSWORD]);
SecretEnVarMapping.push([SECRET_STANDALONE_SERVER_USERNAME, ENVAR_STANDALONE_SERVER_USERNAME]);
SecretEnVarMapping.push([SECRET_STANDALONE_SERVER_2019, ENVAR_STANDALONE_SERVER_2019]);
SecretEnVarMapping.push([SECRET_STANDALONE_SERVER_USERNAME_2019, ENVAR_STANDALONE_SERVER_USERNAME_2019]);
SecretEnVarMapping.push([SECRET_STANDALONE_SERVER_PASSWORD_2019, ENVAR_STANDALONE_SERVER_PASSWORD_2019]);

// Set the values that are not stored in AKV here
process.env[ENVAR_PYTHON_INSTALL_PATH] = NOTEBOOK_PYTHON_INSTALL_PATH;
process.env[ENVAR_RUN_PYTHON3_TEST] = '1';
process.env[ENVAR_RUN_PYSPARK_TEST] = '0';

const credential = new DefaultAzureCredential();
const client = new SecretClient(AKV_URL, credential);

async function main() {
	for (const entry of SecretEnVarMapping) {
		const secretName = entry[0];
		const environmentVariable = entry[1];
		try {
			const result = await client.getSecret(secretName);
			console.log(`${secretName}: ${result.value}`);
			process.env[environmentVariable] = result.value;
		} catch (err) {
			console.error('An error occured while retrieving the value for secret:' + secretName);
			console.error(err);
		}
	}
	console.log('Done reading values from Azure KeyVault!');
	console.log(`Launching new window: ${LAUNCH_OPTION}...`);
	if (LAUNCH_OPTION === LAUNCH_VSCODE) {
		console.warn('Trying to launch vscode, make sure you have it set properly in the PATH environment variable');
	}
	child_process.execSync(LAUNCH_OPTION);
	console.log('New window for running test has been opened.');
}

main();
