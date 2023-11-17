/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';

export interface IFile {
	path: string;
	isDirectory: boolean;
}

export interface IFileSource {

	enumerateFiles(path: string): Promise<IFile[]>;
	mkdir(dirName: string, remoteBasePath: string): Promise<void>;
	createReadStream(path: string): fs.ReadStream;
	readFile(path: string, maxBytes?: number): Promise<Buffer>;
	readFileLines(path: string, maxLines: number): Promise<Buffer>;
	writeFile(localFile: IFile, remoteDir: string): Promise<string>;
	delete(path: string, recursive?: boolean): Promise<void>;
	exists(path: string): Promise<boolean>;
}
