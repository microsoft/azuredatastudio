/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const withDefaults = require('../shared.webpack.config');
const path = require('path');

const clientConfig = withDefaults({
	target: 'webworker',
	context: path.join(__dirname, 'client'),
	entry: {
		extension: './src/browser/jsonClientMain.ts'
	},
	output: {
		filename: 'jsonClientMain.js',
		path: path.join(__dirname, 'client', 'dist', 'browser')
	},
	performance: {
		hints: false
	},
	resolve: {
		alias: {
			'vscode-nls': path.resolve(__dirname, '../../build/polyfills/vscode-nls.js')
		}
	}
});
clientConfig.module.rules[0].use.shift(); // remove nls loader

module.exports = clientConfig;
