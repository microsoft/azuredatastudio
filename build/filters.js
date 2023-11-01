/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Hygiene works by creating cascading subsets of all our files and
 * passing them through a sequence of checks. Here are the current subsets,
 * named according to the checks performed on them. Each subset contains
 * the following one, as described in mathematical notation:
 *
 * all ⊃ eol ⊇ indentation ⊃ copyright ⊃ typescript
 */

const { readFileSync } = require('fs');
const { join } = require('path');

module.exports.all = [
	'*',
	'build/**/*',
	'extensions/**/*',
	'scripts/**/*',
	'src/**/*',
	'test/**/*',
	'!cli/**/*',
	'!out*/**',
	'!test/**/out/**',
	'!**/node_modules/**',

	// {{SQL CARBON EDIT}}
	'!build/actions/**/*.js',
	'!build/**/*'
];

module.exports.unicodeFilter = [
	'**',

	'!**/ThirdPartyNotices.txt',
	'!**/ThirdPartyNotices.cli.txt',
	'!**/LICENSE.{txt,rtf}',
	'!LICENSES.chromium.html',
	'!**/LICENSE',

	'!**/*.{dll,exe,png,bmp,jpg,scpt,cur,ttf,woff,eot,template,ico,icns,opus,wasm,targets,nupkg}',
	'!**/test/**',
	'!**/*.test.ts',
	'!**/*.{d.ts,json,md}',
	'!**/*.mp3',

	'!build/win32/**',
	'!extensions/markdown-language-features/notebook-out/*.js',
	'!extensions/markdown-math/notebook-out/**',
	'!extensions/ipynb/notebook-out/**',
	'!extensions/notebook-renderers/renderer-out/**',
	'!extensions/php-language-features/src/features/phpGlobalFunctions.ts',
	'!extensions/vscode-api-tests/testWorkspace/**',
	'!extensions/vscode-api-tests/testWorkspace2/**',
	'!extensions/**/dist/**',
	'!extensions/**/out/**',
	'!extensions/**/snippets/**',
	'!extensions/**/colorize-fixtures/**',

	'!src/vs/base/browser/dompurify/**',
	'!src/vs/workbench/services/keybinding/browser/keyboardLayouts/**',
];

module.exports.indentationFilter = [
	'**',

	// except specific files
	'!**/*.{dll,exe,png,bmp,jpg,scpt,cur,ttf,woff,eot,template,ico,icns,opus,targets,nupkg}',
	'!**/ThirdPartyNotices.txt',
	'!**/ThirdPartyNotices.cli.txt',
	'!**/LICENSE.{txt,rtf}',
	'!LICENSES.chromium.html',
	'!**/LICENSE',
	'!**/*.mp3',
	'!src/vs/nls.js',
	'!src/vs/nls.build.js',
	'!src/vs/css.js',
	'!src/vs/css.build.js',
	'!src/vs/loader.js',
	'!src/vs/base/browser/dompurify/*',
	'!src/vs/base/common/marked/marked.js',
	'!src/vs/base/common/semver/semver.js',
	'!src/vs/base/node/terminateProcess.sh',
	'!src/vs/base/node/cpuUsage.sh',
	'!test/unit/assert.js',
	'!resources/linux/snap/electron-launch',
	'!build/ext.js',
	'!build/npm/gyp/patches/gyp_spectre_mitigation_support.patch',

	// except specific folders
	'!test/automation/out/**',
	'!test/monaco/out/**',
	'!test/smoke/out/**',
	'!extensions/markdown-math/notebook-out/**',
	'!extensions/ipynb/notebook-out/**',
	'!extensions/vscode-api-tests/testWorkspace/**',
	'!extensions/vscode-api-tests/testWorkspace2/**',
	'!build/monaco/**',
	'!build/win32/**',

	// except multiple specific files
	'!**/package.json',
	'!**/yarn.lock',
	'!**/yarn-error.log',

	// except multiple specific folders
	'!**/codicon/**',
	'!**/fixtures/**',
	'!**/lib/**',
	'!extensions/**/dist/**',
	'!extensions/**/out/**',
	'!extensions/**/snippets/**',
	'!extensions/**/syntaxes/**',
	'!extensions/**/themes/**',
	'!extensions/**/colorize-fixtures/**',

	// except specific file types
	'!src/vs/*/**/*.d.ts',
	'!src/typings/**/*.d.ts',
	'!extensions/**/*.d.ts',
	'!**/*.{svg,exe,png,bmp,jpg,scpt,bat,cmd,cur,ttf,woff,eot,md,ps1,template,yaml,yml,d.ts.recipe,ico,icns,plist,opus,admx,adml,wasm}',
	'!build/{lib,download,linux,darwin}/**/*.js',
	'!build/**/*.sh',
	'!build/azure-pipelines/**/*.js',
	'!build/azure-pipelines/**/*.config',
	'!**/Dockerfile',
	'!**/Dockerfile.*',
	'!**/*.Dockerfile',
	'!**/*.dockerfile',

	// except for built files
	'!extensions/markdown-language-features/media/*.js',
	'!extensions/markdown-language-features/notebook-out/*.js',
	'!extensions/markdown-math/notebook-out/*.js',
	'!extensions/ipynb/notebook-out/**',
	'!extensions/notebook-renderers/renderer-out/*.js',
	'!extensions/simple-browser/media/*.js',

	// {{SQL CARBON EDIT}} Except for our stuff
	'!**/*.{xlf,lcl,docx,sql,vsix,bacpac,ipynb,jpg,gif}',
	'!build/**/*',
	'!extensions/**/coverage/**',
	'!extensions/admin-tool-ext-win/ssmsmin/**',
	'!extensions/admin-tool-ext-win/license/**',
	'!extensions/arc/src/controller/generated/**',
	'!extensions/azuremonitor/sqltoolsservice/**',
	'!extensions/datavirtualization/scaleoutdataservice/**',
	'!extensions/import/flatfileimportservice/**',
	'!extensions/integration-tests/testData/**',
	'!extensions/kusto/sqltoolsservice/**',
	'!extensions/mssql/sqltoolsservice/**',
	'!extensions/resource-deployment/notebooks/**',
	'!extensions/markdown-language-features/media/*.js',
	'!extensions/mssql/notebooks/**',
	'!extensions/simple-browser/media/*.js',
	'!extensions/sql-database-projects/BuildDirectory/SystemDacpacs/**',
	'!extensions/sql-database-projects/resources/templates/*.xml',
	'!extensions/sql-database-projects/src/test/baselines/*.{xml,json,sqlproj}',
	'!extensions/sql-migration/migrationService/**',
	'!resources/linux/snap/electron-launch',
	'!resources/xlf/LocProject.json',
	'!test/coverage/**'
];

module.exports.copyrightFilter = [
	'**',
	'!**/*.desktop',
	'!**/*.json',
	'!**/*.html',
	'!**/*.template',
	'!**/*.md',
	'!**/*.bat',
	'!**/*.cmd',
	'!**/*.ico',
	'!**/*.opus',
	'!**/*.mp3',
	'!**/*.icns',
	'!**/*.xml',
	'!**/*.sh',
	'!**/*.zsh',
	'!**/*.fish',
	'!**/*.txt',
	'!**/*.xpm',
	'!**/*.opts',
	'!**/*.disabled',
	'!**/*.code-workspace',
	'!**/*.js.map',
	'!**/*.wasm',
	'!build/**/*.init',
	'!build/linux/libcxx-fetcher.*',
	'!resources/linux/snap/snapcraft.yaml',
	'!resources/win32/bin/code.js',
	'!resources/completions/**',
	'!extensions/configuration-editing/build/inline-allOf.ts',
	'!extensions/markdown-language-features/media/highlight.css',
	'!extensions/markdown-math/notebook-out/**',
	'!extensions/ipynb/notebook-out/**',
	'!extensions/typescript-language-features/node-maintainer/**',
	'!extensions/html-language-features/server/src/modes/typescript/*',
	'!extensions/*/server/bin/*',
	'!src/vs/editor/test/node/classification/typescript-test.ts',

	// {{SQL CARBON EDIT}} Except for stuff in our code that doesn't use our copyright
	'!extensions/azuremonitor/src/prompts/**',
	'!extensions/import/flatfileimportservice/**',
	'!extensions/kusto/src/prompts/**',
	'!extensions/mssql/sqltoolsservice/**',
	'!extensions/mssql/src/prompts/**',
	'!extensions/notebook/resources/jupyter_config/**',
	'!extensions/notebook/src/intellisense/text.ts',
	'!extensions/notebook/src/prompts/**',
	'!extensions/query-history/images/**',
	'!extensions/sql/build/update-grammar.js',
	'!src/sql/workbench/contrib/notebook/browser/outputs/tableRenderers.ts',
	'!src/sql/workbench/contrib/notebook/common/models/url.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/renderMimeInterfaces.ts',
	'!src/sql/workbench/contrib/notebook/browser/models/outputProcessor.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/mimemodel.ts',
	'!src/sql/workbench/contrib/notebook/browser/cellViews/media/*.css',
	'!src/sql/base/browser/ui/table/plugins/rowSelectionModel.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/rowDetailView.ts',
	'!src/sql/base/browser/ui/table/plugins/headerFilter.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/cellSelectionModel.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/autoSizeColumns.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/rowMoveManager.plugin.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/sanitizer.ts',
	'!src/sql/workbench/contrib/notebook/browser/outputs/renderers.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/tableRenderers.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/registry.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/factories.ts',
	'!src/sql/workbench/services/notebook/common/nbformat.ts',
	'!extensions/markdown-language-features/media/tomorrow.css',
	'!src/sql/workbench/browser/modelComponents/media/highlight.css',
	'!src/sql/workbench/contrib/notebook/electron-browser/cellViews/media/highlight.css',
	'!src/sql/workbench/contrib/notebook/browser/turndownPluginGfm.ts',
	'!**/*.gif',
	'!**/*.xlf',
	'!**/*.dacpac',
	'!**/*.bacpac',
	'!**/*.py',
	'!build/**/*' // {{SQL CARBON EDIT}}
];

module.exports.tsFormattingFilter = [
	'src/**/*.ts',
	'test/**/*.ts',
	'extensions/**/*.ts',
	'!src/vs/*/**/*.d.ts',
	'!src/typings/**/*.d.ts',
	'!extensions/**/*.d.ts',
	'!**/fixtures/**',
	'!**/typings/**',
	'!**/node_modules/**',
	'!extensions/**/colorize-fixtures/**',
	'!extensions/vscode-api-tests/testWorkspace/**',
	'!extensions/vscode-api-tests/testWorkspace2/**',
	'!extensions/**/*.test.ts',
	'!extensions/html-language-features/server/lib/jquery.d.ts',

	// {{SQL CARBON EDIT}}
	'!src/vs/workbench/services/themes/common/textMateScopeMatcher.ts', // skip this because we have no plans on touching this and its not ours
	'!src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts', // skip this because known issue
	'!build/**/*'
];

module.exports.eslintFilter = [
	'**/*.js',
	'**/*.ts',
	...readFileSync(join(__dirname, '../.eslintignore'))
		.toString().split(/\r\n|\n/)
		.filter(line => !line.startsWith('#'))
		.filter(line => !!line)
		.map(line => `!${line}`)
];

module.exports.stylelintFilter = [
	'src/**/*.css'
];
