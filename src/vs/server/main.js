/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
const vscodeServerStartTime = Date.now();

//@ts-ignore
global.vscodeServerStartTime = require('perf_hooks').performance.now();

if (process.argv[2] === '--exec') {
	process.argv.splice(1, 2);
	require(process.argv[1]);
} else {
	const performance = require('../base/common/performance');
	performance.importEntries(['vscodeServerStart', vscodeServerStartTime]);

	const path = require('path');
	const minimist = require('minimist');

	// Do a quick parse to determine if a server or the cli needs to be started
	const parsedArgs = minimist(process.argv.slice(2), {
		boolean: ['start-server', 'list-extensions'],
		string: ['install-extension', 'install-builtin-extension', 'uninstall-extension', 'locate-extension', 'socket-path', 'host', 'port']
	});

	const shouldSpawnCli = (
		!parsedArgs['start-server'] &&
		(!!parsedArgs['list-extensions'] || !!parsedArgs['install-extension'] || !!parsedArgs['install-builtin-extension'] || !!parsedArgs['uninstall-extension'] || !!parsedArgs['locate-extension'])
	);

	loadCode().then((mod) => {
		if (shouldSpawnCli) {
			mod.spawnCli();
		} else {
			mod.spawnServer();
		}
	});

	function loadCode() {
		return new Promise((resolve, reject) => {
			// Set default remote native node modules path, if unset
			process.env['VSCODE_INJECT_NODE_MODULE_LOOKUP_PATH'] = process.env['VSCODE_INJECT_NODE_MODULE_LOOKUP_PATH'] || path.join(__dirname, '..', '..', '..', 'remote', 'node_modules');

			require('../../bootstrap-node').injectNodeModuleLookupPath(process.env['VSCODE_INJECT_NODE_MODULE_LOOKUP_PATH']);
			require('../../bootstrap-amd').load('vs/server/remoteExtensionHostAgent', resolve, reject);
		});
	}
}
