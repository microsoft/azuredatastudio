/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';

import { IFileSource, IFile } from '../fileSources';

export class MockFileSource implements IFileSource {
	filesToReturn: Map<string, IFile[]>;
	constructor() {
		this.filesToReturn = new Map<string, IFile[]>();
	}
	enumerateFiles(filePath: string): Promise<IFile[]> {
		let files: IFile[] = this.filesToReturn.get(filePath);
		return Promise.resolve(files);
	}

	mkdir(dirName: string, remoteBasePath: string): Promise<void> {
		return Promise.resolve(undefined);
	}

	writeFile(localFile: IFile, remoteDir: string): Promise<string> {
		return Promise.resolve(undefined);
	}

	delete(filePath: string): Promise<void> {
		throw new Error('Method not implemented.');
	}

	readFile(filePath: string, maxBytes?: number): Promise<Buffer> {
		throw new Error('Method not implemented.');
	}

	readFileLines(path: string, maxLines: number): Promise<Buffer> {
		throw new Error("Method not implemented.");
	}

	createReadStream(filePath: string): fs.ReadStream {
		throw new Error('Method not implemented.');
	}

	exists(filePath: string): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
}
