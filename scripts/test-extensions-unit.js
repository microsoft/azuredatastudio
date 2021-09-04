/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const execSync = require('child_process').execSync;
const tmp = require('tmp');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const extensionList = [
	'admin-tool-ext-win',
	'agent',
	'arc',
	'azcli',
	'azdata',
	'azurecore',
	'cms',
	'dacpac',
	'data-workspace',
	'import',
	//'mssql',
	'notebook',
	'machine-learning',
	'resource-deployment',
	'schema-compare',
	'sql-database-projects',

];

let argv = require('yargs')
	.command('$0 [extensions...]')
	.choices('extensions', extensionList)
	.default('extensions', extensionList)
	.strict().help().wrap(null).version(false).argv;

let LINUX_EXTRA_ARGS='';

if(os.platform() === 'linux') {
	LINUX_EXTRA_ARGS = '--no-sandbox --disable-dev-shm-usage --use-gl=swiftshader';
}

if (!process.env.INTEGRATION_TEST_ELECTRON_PATH) {
	process.env.INTEGRATION_TEST_ELECTRON_PATH = path.join(__dirname, '..', 'scripts', os.platform() === 'win32' ? 'code.bat' : 'code.sh');
	console.log('Running unit tests out of sources.');
}
else {
	for (const ext of argv.extensions) {
		console.log(execSync(`yarn gulp compile-extension:${ext}`, { encoding: 'utf-8' }));
	}

	console.log(`Running unit tests with '${process.env.INTEGRATION_TEST_ELECTRON_PATH}' as build.`);
}

if (!process.env.ADS_TEST_GREP) {
	console.log('Running stable tests only');

	process.env.ADS_TEST_GREP = '@UNSTABLE@';
	process.env.ADS_TEST_INVERT_GREP = 1;
}

// execute tests

for (const ext of argv.extensions) {
	console.log('*'.repeat(ext.length + 23));
	console.log(`*** starting ${ext} tests ***`);
	console.log('*'.repeat(ext.length + 23));
	// set up environment
	const VSCODEUSERDATADIR = tmp.dirSync({ prefix: `adsuser_${ext}` }).name;
	const VSCODEEXTENSIONSDIR = tmp.dirSync({ prefix: `adsext_${ext}` }).name;

	console.log(`VSCODEUSERDATADIR : ${VSCODEUSERDATADIR}`);
	console.log(`VSCODEEXTENSIONSDIR : ${VSCODEEXTENSIONSDIR}`);

	const command = `${process.env.INTEGRATION_TEST_ELECTRON_PATH} ${LINUX_EXTRA_ARGS} --extensionDevelopmentPath=${path.join(__dirname, '..', 'extensions', ext)} --extensionTestsPath=${path.join(__dirname, '..', 'extensions', ext, 'out', 'test')} --user-data-dir=${VSCODEUSERDATADIR} --extensions-dir=${VSCODEEXTENSIONSDIR} --remote-debugging-port=9222 --disable-telemetry --disable-crash-reporter --disable-updates --no-cached-data --disable-keytar`;
	console.log(`Command used: ${command}`);
	const env = {
		VSCODE_CLI: 1,
		ELECTRON_ENABLE_STACK_DUMPING: 1,
		ELECTRON_ENABLE_LOGGING: 1
	};
	console.log(execSync(command, { stdio: 'inherit', env: env}));

	// clean up
	if (!process.env.NO_CLEANUP) {
		fs.remove(VSCODEUSERDATADIR, { recursive: true }).catch(console.error);
		fs.remove(VSCODEEXTENSIONSDIR, { recursive: true }).catch(console.error);
	}
}
