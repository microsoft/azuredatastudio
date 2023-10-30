/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');
const webpack = require('webpack');
const fancyLog = require('fancy-log');
const ansiColors = require('ansi-colors');
const { Mangler } = require('../build/lib/mangle/index');

/**
 * Map of project paths to mangled file contents
 *
 * @type {Map<string, Promise<Map<string, { out: string; sourceMap?: string }>>>}
 */
const mangleMap = new Map();

/**
 * @param {string} projectPath
 */
function getMangledFileContents(projectPath) {
	let entry = mangleMap.get(projectPath);
	if (!entry) {
		const log = (...data) => fancyLog(ansiColors.blue('[mangler]'), ...data);
		log(`Mangling ${projectPath}`);
		const ts2tsMangler = new Mangler(projectPath, log, { mangleExports: true, manglePrivateFields: true });
		entry = ts2tsMangler.computeNewFileContents();
		mangleMap.set(projectPath, entry);
	}

	return entry;
}

/**
 * @type {webpack.LoaderDefinitionFunction}
 */
module.exports = async function (source, sourceMap, meta) {
	return source; // {{SQL CARBON EDIT}} skip mangling
};
