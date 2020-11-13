/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdownList';
import * as DOM from 'vs/base/browser/dom';
import { IListRenderer } from 'vs/base/browser/ui/list/list';
const $ = DOM.$;

export const SELECT_OPTION_ENTRY_TEMPLATE_ID = 'editableDropDownOption.entry.template';

export interface ISelectListTemplateData {
	root: HTMLElement;
	text: HTMLElement;
}

export interface IDropDownListItem {
	text: string;
}

export class SelectListRenderer implements IListRenderer<IDropDownListItem, ISelectListTemplateData> {

	get templateId(): string { return SELECT_OPTION_ENTRY_TEMPLATE_ID; }

	renderTemplate(container: HTMLElement): ISelectListTemplateData {
		const data: ISelectListTemplateData = Object.create(null);
		data.root = container;
		data.text = DOM.append(container, $('span.editable-drop-option-text'));
		return data;
	}

	renderElement(element: IDropDownListItem, index: number, templateData: ISelectListTemplateData): void {
		const data: ISelectListTemplateData = templateData;
		const text = element.text;
		data.text.textContent = text;
		data.text.title = text;
	}

	disposeTemplate(templateData: ISelectListTemplateData): void {
	}
}

export class DropdownDataSource {
	values: string[];

	filter: string | undefined;

	public get filteredValues(): string[] {
		if (this.filter) {
			return this.values.filter(v => {
				return v.toLocaleLowerCase().indexOf(this.filter.toLocaleLowerCase()) !== -1;
			});
		}
		return this.values;
	}
}
