/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { FileExtension } from './bookTocManager';

export class BookPathHandler {
	public fileInTocEntry: string;
	public titleInTocEntry: string;
	public fileExtension: FileExtension;
	constructor(public filePath: string, public bookRoot: string, title?: string) {
		const relativePath = path.relative(bookRoot, filePath);
		const pathDetails = path.parse(relativePath);
		this.fileInTocEntry = relativePath.replace(pathDetails.ext, '');
		this.titleInTocEntry = title ? title : pathDetails.name;
		this.fileExtension = pathDetails.ext === FileExtension.Notebook ? FileExtension.Notebook : FileExtension.Markdown;
	}
}
