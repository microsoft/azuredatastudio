/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { FileExtension } from './bookTocManager';

export class BookPathHandler {
	public fileInTocPath: string;
	public fileName: string;
	public fileExtension: FileExtension;
	constructor(public filePath: string, public bookRoot?: string) {
		let pathDetails: path.ParsedPath;
		if (bookRoot) {
			pathDetails = path.parse(path.relative(bookRoot, filePath));
			this.fileInTocPath = path.posix.join(path.posix.sep, pathDetails.name);
		} else {
			pathDetails = path.parse(filePath);
		}
		this.fileName = pathDetails.name;
		this.fileExtension = pathDetails.ext ? FileExtension.Notebook : FileExtension.Markdown;
	}
}
