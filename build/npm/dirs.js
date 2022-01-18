/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Complete list of directories where yarn should be executed to install node modules
exports.dirs = [
	'',
	'build',
	'build/lib/watch',
	'extensions',
	// {{SQL CARBON EDIT}} Add ADS extensions and remove VSCode ones
	'extensions/admin-tool-ext-win',
	'extensions/agent',
	'extensions/arc',
	'extensions/azcli',
	'extensions/azurecore',
	'extensions/azurehybridtoolkit',
	'extensions/azuremonitor',
	'extensions/big-data-cluster',
	'extensions/cms',
	'extensions/configuration-editing',
	'extensions/dacpac',
	'extensions/data-workspace',
	'extensions/git',
	'extensions/github',
	'extensions/github-authentication',
	'extensions/image-preview',
	'extensions/import',
	'extensions/integration-tests',
	'extensions/json-language-features',
	'extensions/json-language-features/server',
	'extensions/kusto',
	'extensions/liveshare',
	'extensions/machine-learning',
	'extensions/markdown-language-features',
	'extensions/markdown-math',
	'extensions/merge-conflict',
	'extensions/microsoft-authentication',
	'extensions/mssql',
	'extensions/notebook',
	'extensions/profiler',
	'extensions/python',
	'extensions/query-history',
	'extensions/resource-deployment',
	'extensions/schema-compare',
	'extensions/search-result',
	'extensions/server-report',
	'extensions/simple-browser',
	'extensions/sql-assessment',
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
