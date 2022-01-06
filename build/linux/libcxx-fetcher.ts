// Can be removed once https://github.com/electron/electron-rebuild/pull/703 is available.

'use strict';

import * as debug from 'debug';
import * as extract from 'extract-zip';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as packageJSON from '../../package.json';
import { downloadArtifact } from '@electron/get';

const d = debug('libcxx-fetcher');

export async function downloadLibcxxHeaders(outDir: string, electronVersion: string, lib_name: string): Promise<void> {
	if (await fs.pathExists(path.resolve(outDir, 'include'))) return;
	if (!await fs.pathExists(outDir)) await fs.mkdirp(outDir);

	d(`downloading ${lib_name}_headers`);
	const headers = await downloadArtifact({
		version: electronVersion,
		isGeneric: true,
		artifactName: `${lib_name}_headers.zip`,
	});

	d(`unpacking ${lib_name}_headers from ${headers}`);
	await extract(headers, { dir: outDir });
}

export async function downloadLibcxxObjects(outDir: string, electronVersion: string, targetArch: string = 'x64'): Promise<void> {
	if (await fs.pathExists(path.resolve(outDir, 'libc++.a'))) return;
	if (!await fs.pathExists(outDir)) await fs.mkdirp(outDir);

	d(`downloading libcxx-objects-linux-${targetArch}`);
	const objects = await downloadArtifact({
		version: electronVersion,
		platform: 'linux',
		artifactName: 'libcxx-objects',
		arch: targetArch,
	});

	d(`unpacking libcxx-objects from ${objects}`);
	await extract(objects, { dir: outDir });
}

async function main(): Promise<void> {
	const libcxxObjectsDirPath = process.env['VSCODE_LIBCXX_OBJECTS_DIR'];
	const libcxxHeadersDownloadDir = process.env['VSCODE_LIBCXX_HEADERS_DIR'];
	const libcxxabiHeadersDownloadDir = process.env['VSCODE_LIBCXXABI_HEADERS_DIR'];
	const arch = process.env['VSCODE_ARCH'];
	const electronVersion = packageJSON.devDependencies.electron;

	if (!libcxxObjectsDirPath || !libcxxHeadersDownloadDir || !libcxxabiHeadersDownloadDir) {
		throw new Error('Required build env not set');
	}

	await downloadLibcxxObjects(libcxxObjectsDirPath, electronVersion, arch);
	await downloadLibcxxHeaders(libcxxHeadersDownloadDir, electronVersion, 'libcxx');
	await downloadLibcxxHeaders(libcxxabiHeadersDownloadDir, electronVersion, 'libcxxabi');
}

if (require.main === module) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
