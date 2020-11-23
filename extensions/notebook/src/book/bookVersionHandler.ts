/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ValueGetterInvocation } from 'typemoq/_all';
import { JupyterBookSection, IJupyterBookSectionV1, IJupyterBookSectionV2 } from '../contracts/content';
import { BookVersion } from './bookModel';

export class BookVersionHandler {

	constructor() { }
	public newToc: JupyterBookSection[];

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

	public convertTo(version: string, tableOfContents: JupyterBookSection): JupyterBookSection {
		if (version === BookVersion.v1) {
			return Object.assign(tableOfContents, {
				title: tableOfContents.title,
				url: tableOfContents.url ? tableOfContents.url : tableOfContents.file,
				sections: tableOfContents.sections,
				expand_sections: tableOfContents.expand_sections,
				search: tableOfContents.search,
				divider: tableOfContents.divider,
				header: tableOfContents.header,
				external: tableOfContents.url ? true : false
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

	public convertTocTo(tableOfContents: JupyterBookSection[]): JupyterBookSection[] {
		let newToc = new Array<JupyterBookSection>(tableOfContents.length);

		for (const [index, section] of tableOfContents.entries()) {
			newToc[index] = this.dfs(section);
		}
		return newToc;
	}

	public dfs(section: JupyterBookSection): JupyterBookSection {
		if (section.sections === undefined || section.sections?.length === 0) {
			return { title: section.title, url: section.file };
		} else {
			let newSection = {} as JupyterBookSection;
			newSection['title'] = section.title;
			newSection['url'] = section.file;
			newSection.sections = [] as JupyterBookSection[];
			for (let s of section.sections) {
				const child = this.dfs(s);
				newSection.sections.push(child);
			}
			return newSection;
		}
	}

}
