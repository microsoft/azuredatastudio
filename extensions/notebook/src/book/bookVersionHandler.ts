/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterBookSection, IJupyterBookSectionV1, IJupyterBookSectionV2 } from '../contracts/content';
import * as path from 'path';

export enum BookVersion {
	v1 = 'v1',
	v2 = 'v2'
}

export function getContentPath(version: string, bookPath: string, filePath: string): string {
	return BookVersion.v1 === version ? path.posix.join(bookPath, 'content', filePath) : path.posix.join(bookPath, filePath);
}

export function getTocPath(version: string, bookPath: string): string {
	return BookVersion.v1 === version ? path.posix.join(bookPath, '_data', 'toc.yml') : path.posix.join(bookPath, '_toc.yml');
}

/**
 * Parses a section to JupyterSection, which is the union of  Jupyter Book v1 and v2 interfaces.
 * There are conflicting properties between v1 and v2 Jupyter Book toc properties,
 * this method converts v1 to v2 while keeping the v1 properties that do not exist in v2.
 * @param version Version of the section that will be converted
 * @param section The section that'll be converted.
*/
export function convertFrom(version: string, section: JupyterBookSection): JupyterBookSection {
	if (version === BookVersion.v1) {
		return Object.assign(section, {
			title: section.title,
			file: (section as IJupyterBookSectionV1).external ? undefined : section.url,
			url: (section as IJupyterBookSectionV1).external ? section.url : undefined,
			sections: section.sections,
			expand_sections: section.expand_sections,
			search: (section as IJupyterBookSectionV1).search,
			divider: (section as IJupyterBookSectionV1).divider,
			header: (section as IJupyterBookSectionV1).header,
			external: (section as IJupyterBookSectionV1).external,
			numbered: (section as IJupyterBookSectionV1).not_numbered !== undefined ? !(section as IJupyterBookSectionV1).not_numbered : undefined,
			not_numbered: undefined
		});
	} else {
		return Object.assign(section, {
			title: section.title,
			file: (section as IJupyterBookSectionV2).file,
			url: section.url,
			sections: section.sections,
			expand_sections: section.expand_sections,
			numbered: (section as IJupyterBookSectionV2).numbered,
			header: (section as IJupyterBookSectionV2).header,
			chapters: (section as IJupyterBookSectionV2).chapters,
			part: (section as IJupyterBookSectionV2).part
		});
	}
}

/**
 * This method is used by JupyterBookSection to convert it's numbered property to
 * not_numberered.
 * Or it's used by an JupyterBookSectionV1 to make a deep copy of an object.
 * @param section The section that'll be converted.
*/
function convertNotNumbered(section: JupyterBookSection): boolean | undefined {
	if (section.numbered !== undefined) {
		return !section.numbered;
	}
	return section.not_numbered !== undefined ? section.not_numbered : undefined;
}

/**
 * Converts the JupyterSection to either Jupyter Book v1 or v2.
 * This method is also used to make a deep copy of a section object.
 * @param version Version of the section that will be converted
 * @param section The section that'll be converted.
*/
export function convertTo(version: string, section: JupyterBookSection): JupyterBookSection {
	if (version === BookVersion.v1) {
		if (section.sections && section.sections.length > 0) {
			let temp: JupyterBookSection = {};
			temp.title = section.title;
			temp.url = section.url ? section.url : section.file;
			temp.expand_sections = section.expand_sections;
			temp.not_numbered = convertNotNumbered(section);
			temp.search = section.search;
			temp.divider = section.divider;
			temp.header = section.header;
			temp.external = section.external;
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
			newSection.not_numbered = convertNotNumbered(section);
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
			temp.file = section.file;
			temp.expand_sections = section.expand_sections;
			temp.header = section.header;
			temp.numbered = section.numbered;
			temp.part = section.part;
			temp.chapters = section.chapters;
			temp.url = section.url;
			temp.sections = [];
			for (let s of section.sections) {
				const child = this.convertTo(version, s);
				temp.sections.push(child);
			}
			return temp;
		} else {
			let newSection: JupyterBookSection = {};
			newSection.title = section.title;
			newSection.file = section.file;
			newSection.sections = section.sections;
			newSection.expand_sections = section.expand_sections;
			newSection.header = section.header;
			newSection.numbered = section.numbered;
			newSection.part = section.part;
			newSection.chapters = section.chapters;
			newSection.url = section.url;
			return newSection;
		}
	}
	return {};
}
