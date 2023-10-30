/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';
import * as DOM from 'vs/base/browser/dom';
import { IListRenderer } from 'vs/base/browser/ui/list/list';
const $ = DOM.$;

export const SELECT_OPTION_ENTRY_TEMPLATE_ID = 'editableDropDownOption.entry.template';

export interface IDropdownListTemplateData {
	root: HTMLElement;
	text: HTMLElement;
}

export interface IDropdownListItem {
	text: string;
}

export class DropdownListRenderer implements IListRenderer<IDropdownListItem, IDropdownListTemplateData> {

	get templateId(): string { return SELECT_OPTION_ENTRY_TEMPLATE_ID; }

	renderTemplate(container: HTMLElement): IDropdownListTemplateData {
		const data: IDropdownListTemplateData = Object.create(null);
		data.root = container;
		data.text = DOM.append(container, $('span.editable-drop-option-text'));
		return data;
	}

	renderElement(element: IDropdownListItem, index: number, templateData: IDropdownListTemplateData): void {
		const data: IDropdownListTemplateData = templateData;
		const text = element.text;
		data.text.textContent = text;
		data.text.title = text;
	}

	disposeTemplate(templateData: IDropdownListTemplateData): void {
	}
}

export class DropdownDataSource {
	public values: string[] = [];

	public filter: string | undefined = undefined;

	public get filteredValues(): string[] {
		if (this.filter) {
			return this.values.filter(v => {
				return v.toLocaleLowerCase().indexOf(this.filter.toLocaleLowerCase()) !== -1;
			});
		}
		return this.values;
	}
}
