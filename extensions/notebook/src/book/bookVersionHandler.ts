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

	public convertTo(version: string, section: JupyterBookSection): JupyterBookSection {
		if (version === BookVersion.v1) {
			if (section.sections && section.sections.length > 0) {
				let temp: JupyterBookSection = {};
				temp.title = section.title;
				temp.url = section.url ? section.url : section.file;
				temp.sections = [];
				for (let s of section.sections) {
					const child = this.convertTo(version, s);
					temp.sections.push(child);
				}
				return temp;
			} else {
				let newSection: JupyterBookSection = {};
				newSection.title = section.title;
				newSection.url = section.url ? section.url : section.file;
				newSection.sections = section.sections;
				newSection.expand_sections = section.expand_sections;
				newSection.search = section.search;
				newSection.divider = section.divider;
				newSection.header = section.header;
				newSection.external = section.external;
				return newSection;
			}
		}
		else if (version === BookVersion.v2) {
			if (section.sections && section.sections.length > 0) {
				let temp: JupyterBookSection = {};
				temp.title = section.title;
				temp.file = section.url ? section.url : section.file;
				temp.sections = [];
				for (let s of section.sections) {
					const child = this.convertTo(version, s);
					temp.sections.push(child);
				}
				return temp;
			} else {
				let newSection: JupyterBookSection = {};
				newSection.title = section.title;
				newSection.file = section.url ? section.url : section.file;
				newSection.sections = section.sections;
				newSection.expand_sections = section.expand_sections;
				newSection.header = section.header;
				newSection.url = section.external ? section.url : undefined;
				return newSection;
			}
		}
		return {};
	}
}
