/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');

// Complete list of directories where yarn should be executed to install node modules
const dirs = [
	'',
	'build',
	'extensions',
	// {{SQL CARBON EDIT}} Add ADS extensions and remove VSCode ones
	'extensions/admin-tool-ext-win',
	'extensions/agent',
	'extensions/arc',
	'extensions/azcli',
	'extensions/azurecore',
	'extensions/azuremonitor',
	'extensions/cms',
	'extensions/configuration-editing',
	'extensions/dacpac',
	'extensions/data-workspace',
	'extensions/datavirtualization',
	'extensions/git',
	'extensions/git-base',
	'extensions/github',
	'extensions/github-authentication',
	'extensions/import',
	'extensions/integration-tests',
	'extensions/ipynb',
	'extensions/javascript',
	'extensions/json-language-features',
	'extensions/json-language-features/server',
	'extensions/kusto',
	'extensions/machine-learning',
	'extensions/markdown-language-features/server',
	'extensions/markdown-language-features',
	'extensions/markdown-math',
	'extensions/media-preview',
	'extensions/merge-conflict',
	'extensions/microsoft-authentication',
	'extensions/mssql',
	'extensions/notebook',
	'extensions/notebook-renderers',
	'extensions/profiler',
	'extensions/query-history',
	'extensions/resource-deployment',
	'extensions/schema-compare',
	'extensions/search-result',
	'extensions/server-report',
	'extensions/simple-browser',
	'extensions/sql-assessment',
	'extensions/sql-bindings',
	'extensions/sql-database-projects',
	'extensions/sql-migration',
	'extensions/vscode-test-resolver',
	'extensions/xml-language-features',
	// {{SQL CARBON EDIT}} - End
	'remote',
	'remote/web',
	'test/automation',
	'test/integration/browser',
	'test/monaco',
	'test/smoke',
];

if (fs.existsSync(`${__dirname}/../../.build/distro/npm`)) {
	dirs.push('.build/distro/npm');
	dirs.push('.build/distro/npm/remote');
	dirs.push('.build/distro/npm/remote/web');
}

exports.dirs = dirs;
