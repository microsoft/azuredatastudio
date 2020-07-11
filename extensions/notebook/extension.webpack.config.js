/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const withDefaults = require('../shared.webpack.config');
const fs = require('fs');
const path = require('path');

const externals = {
	'node-fetch': 'commonjs node-fetch',
	'adm-zip': 'commonjs adm-zip'
};

// conditionally add ws if we are going to be running in a node environment
const yarnrcPath = path.join(__dirname, '.yarnrc');
if (fs.existsSync(yarnrcPath)) {
	const yarnrc = fs.readFileSync(yarnrcPath).toString();
	const properties = yarnrc.split(/\r?\n/).map(r => r.split(' '));
	if (properties.find(r => r[0] === 'runtime')[1] === '"node"') {
		externals['ws'] = 'commonjs ws';
	}
}

module.exports = withDefaults({
	context: __dirname,
	entry: {
		extension: './src/extension.ts'
	},
	externals: externals
});
