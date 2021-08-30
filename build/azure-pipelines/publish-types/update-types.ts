/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';

let tag = '';
try {
	tag = cp
		.execSync('git describe --tags `git rev-list --tags --max-count=1`')
		.toString()
		.trim();

	const dtsUri = `https://raw.githubusercontent.com/microsoft/azuredatastudio/${tag}/src/sql/azdata.d.ts`; // {{SQL CARBON EDIT}} Use our typings
	const outPath = path.resolve(process.cwd(), 'DefinitelyTyped/types/azdata/index.d.ts'); // {{SQL CARBON EDIT}} Use our typings
	cp.execSync(`curl ${dtsUri} --output ${outPath}`);

	updateDTSFile(outPath, tag);

	console.log(`Done updating azdata.d.ts at ${outPath}`); // {{SQL CARBON EDIT}} Use our typings
} catch (err) {
	console.error(err);
	console.error('Failed to update types');
	process.exit(1);
}

function updateDTSFile(outPath: string, tag: string) {
	const oldContent = fs.readFileSync(outPath, 'utf-8');
	const newContent = getNewFileContent(oldContent, tag);

	fs.writeFileSync(outPath, newContent);
}

function repeat(str: string, times: number): string {
	const result = new Array(times);
	for (let i = 0; i < times; i++) {
		result[i] = str;
	}
	return result.join('');
}

function convertTabsToSpaces(str: string): string {
	return str.replace(/\t/gm, value => repeat('    ', value.length));
}

function getNewFileContent(content: string, tag: string) {
	const oldheader = [
		`/*---------------------------------------------------------------------------------------------`,
		` *  Copyright (c) Microsoft Corporation. All rights reserved.`,
		` *  Licensed under the Source EULA. See License.txt in the project root for license information.`,
		` *--------------------------------------------------------------------------------------------*/`
	].join('\n');

	return convertTabsToSpaces(getNewFileHeader(tag) + content.slice(oldheader.length));
}

function getNewFileHeader(tag: string) {
	const [major, minor] = tag.split('.');
	const shorttag = `${major}.${minor}`;

	// {{SQL CARBON EDIT}} Use our own header
	const header = [
		`// Type definitions for Azure Data Studio ${shorttag}`,
		`// Project: https://github.com/microsoft/azuredatastudio`,
		`// Definitions by: Charles Gagnon <https://github.com/Charles-Gagnon>`,
		`//                 Alan Ren: <https://github.com/alanrenmsft>`,
		`//                 Karl Burtram: <https://github.com/kburtram>`,
		`//                 Ken Van Hyning: <https://github.com/kenvanhyning>`,
		`// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped`,
		``,
		`/*---------------------------------------------------------------------------------------------`,
		` *  Copyright (c) Microsoft Corporation. All rights reserved.`,
		` *  Licensed under the MIT License.`,
		` *  See https://github.com/Microsoft/azuredatastudio/blob/main/LICENSE.txt for license information.`,
		` *--------------------------------------------------------------------------------------------*/`,
		``,
		`/**`,
		` * Type Definition for Azure Data Studio ${shorttag} Extension API`,
		` * See https://docs.microsoft.com/sql/azure-data-studio/extensibility-apis for more information`,
		` */`
	].join('\n');

	return header;
}
