/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//@ts-check

const path = require('path');
const fse = require('fs-extra');
const esbuild = require('esbuild');

const args = process.argv.slice(2);

const isWatch = args.indexOf('--watch') >= 0;

let outputRoot = __dirname;
const outputRootIndex = args.indexOf('--outputRoot');
if (outputRootIndex >= 0) {
	outputRoot = args[outputRootIndex + 1];
}

const srcDir = path.join(__dirname, 'notebook');
const outDir = path.join(outputRoot, 'notebook-out');

async function build() {
	await esbuild.build({
		entryPoints: [
			path.join(srcDir, 'katex.ts'),
		],
		bundle: true,
		minify: true,
		sourcemap: false,
		format: 'esm',
		outdir: outDir,
		platform: 'browser',
		target: ['es2020'],
	});

	fse.copySync(
		path.join(__dirname, 'node_modules', 'katex', 'dist', 'katex.min.css'),
		path.join(outDir, 'katex.min.css'));

	const fontsDir = path.join(__dirname, 'node_modules', 'katex', 'dist', 'fonts');
	const fontsOutDir = path.join(outDir, 'fonts/');

	fse.mkdirSync(fontsOutDir, { recursive: true });

	for (const file of fse.readdirSync(fontsDir)) {
		if (file.endsWith('.woff2')) {
			fse.copyFileSync(path.join(fontsDir, file), path.join(fontsOutDir, file));
		}
	}
}


build().catch(() => process.exit(1));

if (isWatch) {
	const watcher = require('@parcel/watcher');
	watcher.subscribe(srcDir, async () => {
		try {
			await build();
		} catch (e) {
			console.error(e);
		}
	});
}
