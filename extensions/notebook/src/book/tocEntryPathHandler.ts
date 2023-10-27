/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { FileExtension } from '../common/utils';

export class TocEntryPathHandler {
	public readonly fileInTocEntry: string;
	public readonly titleInTocEntry: string;
	public readonly fileExtension: FileExtension;

	/**
	 * Creates an object that contains the specific format for title and file entries in a Jupyter Book table of contents
	 * that is compatible on Windows and Mac.
	*/
	constructor(public readonly filePath: string, public readonly bookRoot: string, title?: string) {
		//To keep consistency how the file entries are in Jupyter Book toc on Windows and Mac.
		const tocRelativePath = path.posix.join(path.posix.sep, path.posix.relative(bookRoot, filePath));
		const pathDetails = path.parse(tocRelativePath);
		this.fileInTocEntry = tocRelativePath.replace(pathDetails.ext, '');
		this.titleInTocEntry = title ?? pathDetails.name;
		this.fileExtension = pathDetails.ext === FileExtension.Notebook ? FileExtension.Notebook : FileExtension.Markdown;
	}
}
