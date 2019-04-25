/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const withDefaults = require('../shared.webpack.config');

module.exports = withDefaults({
	context: __dirname,
	entry: {
		main: './src/main.ts'
	},
	externals: {
		'dataprotocol-client': 'commonjs dataprotocol-client',
		'vscode-languageclient': 'commonjs vscode-languageclient',
		'vscode-extension-telemetry': 'commonjs vscode-extension-telemetry',
		'request': 'commonjs request',
	}
});
