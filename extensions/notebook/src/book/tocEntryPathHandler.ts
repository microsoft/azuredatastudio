/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { FileExtension } from '../common/utils';

export class TocEntryPathHandler {
	public readonly fileInTocEntry: string;
	public readonly titleInTocEntry: string;
	public readonly fileExtension: FileExtension;
	constructor(public readonly filePath: string, public readonly bookRoot: string, title?: string) {
		const relativePath = path.posix.join(path.posix.sep, path.posix.relative(bookRoot, filePath));
		const pathDetails = path.parse(relativePath);
		this.fileInTocEntry = relativePath.replace(pathDetails.ext, '');
		this.titleInTocEntry = title ?? pathDetails.name;
		this.fileExtension = pathDetails.ext === FileExtension.Notebook ? FileExtension.Notebook : FileExtension.Markdown;
	}
}
