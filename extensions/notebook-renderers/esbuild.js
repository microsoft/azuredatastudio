/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// @ts-check
const path = require('path');
const esbuild = require('esbuild');

const args = process.argv.slice(2);

const isWatch = args.indexOf('--watch') >= 0;

let outputRoot = __dirname;
const outputRootIndex = args.indexOf('--outputRoot');
if (outputRootIndex >= 0) {
	outputRoot = args[outputRootIndex + 1];
}

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(outputRoot, 'renderer-out');

function build() {
	return esbuild.build({
		entryPoints: [
			path.join(srcDir, 'index.ts'),
		],
		bundle: true,
		minify: false,
		sourcemap: false,
		format: 'esm',
		outdir: outDir,
		platform: 'browser',
		target: ['es2020'],
	});
}

build().catch(() => process.exit(1));

if (isWatch) {
	const watcher = require('@parcel/watcher');
	watcher.subscribe(srcDir, () => {
		return build();
	});
}
