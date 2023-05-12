/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const withDefaults = require('../shared.webpack.config');

module.exports = withDefaults({
	context: path.join(__dirname),
	entry: {
		extension: './src/node/htmlServerNodeMain.ts',
	},
	output: {
		filename: 'htmlServerMain.js',
		path: path.join(__dirname, 'dist', 'node'),
	},
	externals: {
		'native-is-elevated': 'commonjs native-is-elevated',
	}
});
