/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterBookSection, IJupyterBookSectionV1, IJupyterBookSectionV2 } from '../contracts/content';
import { BookVersion } from './bookModel';

export class BookVersionHandler {

	constructor() { }

	public convertFrom(version: string, tableOfContents: JupyterBookSection): JupyterBookSection {
		if (version === BookVersion.v1) {
			return Object.assign(tableOfContents, {
				title: tableOfContents.title,
				file: (tableOfContents as IJupyterBookSectionV1).external ? undefined : tableOfContents.url,
				url: (tableOfContents as IJupyterBookSectionV1).external ? tableOfContents.url : undefined,
				sections: tableOfContents.sections,
				expand_sections: tableOfContents.expand_sections,
				search: (tableOfContents as IJupyterBookSectionV1).search,
				divider: (tableOfContents as IJupyterBookSectionV1).divider,
				header: (tableOfContents as IJupyterBookSectionV1).header,
				external: (tableOfContents as IJupyterBookSectionV1).external
			});
		} else {
			return Object.assign(tableOfContents, {
				title: tableOfContents.title,
				file: (tableOfContents as IJupyterBookSectionV2).file,
				url: tableOfContents.url,
				sections: tableOfContents.sections,
				expand_sections: tableOfContents.expand_sections
			});
		}
	}
}
