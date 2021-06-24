/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const withDefaults = require('../shared.webpack.config');

const externals = {
	'htmlparser2' : 'commonjs htmlparser2'
};

module.exports = withDefaults({
	context: __dirname,
	entry: {
		extension: './src/extension.ts'
	},
	externals: externals
});
