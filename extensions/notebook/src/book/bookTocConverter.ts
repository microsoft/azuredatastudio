/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterBookSection, IJupyterBookSectionV1, IJupyterBookSectionV2 } from '../contracts/content';

export function convertFromV1(tableOfContents: IJupyterBookSectionV1): JupyterBookSection {
	return Object.assign(tableOfContents, {
		title: tableOfContents.title,
		file: tableOfContents.url,
		url: tableOfContents.external ? tableOfContents.url : undefined,
		sections: tableOfContents.sections,
		expand_sections: tableOfContents.expand_sections,
	});
}

export function convertFromV2(tableOfContents: IJupyterBookSectionV2): JupyterBookSection {
	return Object.assign(tableOfContents, {
		title: tableOfContents.title,
		file: tableOfContents.file,
		url: tableOfContents.url,
		sections: tableOfContents.sections,
		expand_sections: tableOfContents.expand_sections,
	});
}

export function convertToV1(tableOfContents: JupyterBookSection): IJupyterBookSectionV1 {
	return Object.assign(tableOfContents, {
		title: tableOfContents.title,
		url: tableOfContents.file !== undefined ? tableOfContents.file : tableOfContents.url,
		sections: tableOfContents.sections,
		expand_sections: tableOfContents.expand_sections,
		external: tableOfContents.url !== undefined ? true : false,
	});
}

