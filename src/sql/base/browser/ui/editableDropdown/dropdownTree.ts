/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { generateUuid } from 'vs/base/common/uuid';
import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { $ } from 'sql/base/browser/builder';

export interface Template {
	label: HTMLElement;
	row: HTMLElement;
}

export interface Resource {
	value: string;
}

export class DropdownModel {
	public static ID = generateUuid();
}

export class DropdownRenderer implements tree.IRenderer {
	public getHeight(tree: tree.ITree, element: Resource): number {
		return 22;
	}

	public getTemplateId(tree: tree.ITree, element: Resource): string {
		return '';
	}

	public renderTemplate(tree: tree.ITree, templateId: string, container: HTMLElement): Template {
		const row = $('div.list-row').style('height', '22px').style('padding-left', '5px').getHTMLElement();
		DOM.append(container, row);
		const label = $('span.label').style('margin', 'auto').style('vertical-align', 'middle').getHTMLElement();
		DOM.append(row, label);

		return { label, row };
	}

	public renderElement(tree: tree.ITree, element: Resource, templateId: string, templateData: Template): void {
		templateData.label.innerText = element.value;
		templateData.row.title = element.value;
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: Template): void {
		// no op
	}
}

export class DropdownDataSource implements tree.IDataSource {
	public options: Array<Resource>;

	public getId(tree: tree.ITree, element: Resource | DropdownModel): string {
		if (element instanceof DropdownModel) {
			return DropdownModel.ID;
		} else {
			return (element as Resource).value;
		}
	}

	public hasChildren(tree: tree.ITree, element: Resource | DropdownModel): boolean {
		if (element instanceof DropdownModel) {
			return true;
		} else {
			return false;
		}
	}

	public getChildren(tree: tree.ITree, element: Resource | DropdownModel): Promise<any> {
		if (element instanceof DropdownModel) {
			return TPromise.as(this.options);
		} else {
			return TPromise.as(undefined);
		}
	}

	public getParent(tree: tree.ITree, element: Resource | DropdownModel): Promise<any> {
		if (element instanceof DropdownModel) {
			return TPromise.as(undefined);
		} else {
			return TPromise.as(new DropdownModel());
		}
	}
}

export class DropdownFilter extends TreeDefaults.DefaultFilter {
	public filterString: string;

	public isVisible(tree: tree.ITree, element: Resource): boolean {
		return element.value.toLowerCase().includes(this.filterString.toLowerCase());
	}
}

export class DropdownController extends TreeDefaults.DefaultController {
	private _onSelectionChange = new Emitter<Resource>();
	public readonly onSelectionChange: Event<Resource> = this._onSelectionChange.event;

	private _onDropdownEscape = new Emitter<void>();
	public readonly onDropdownEscape: Event<void> = this._onDropdownEscape.event;

	constructor() {
		super();
	}

	protected onEscape(tree: tree.ITree, event: IKeyboardEvent): boolean {
		let response = super.onEscape(tree, event);
		this._onDropdownEscape.fire();
		return response;
	}

	protected onLeftClick(tree: tree.ITree, element: any, eventish: TreeDefaults.ICancelableEvent, origin: string): boolean {
		let response = super.onLeftClick(tree, element, eventish, origin);
		if (response) {
			this._onSelectionChange.fire(tree.getSelection()[0]);
		}
		return response;
	}

	protected onEnter(tree: tree.ITree, event: IKeyboardEvent): boolean {
		let response = super.onEnter(tree, event);
		if (response) {
			this._onSelectionChange.fire(tree.getSelection()[0]);
		}
		return response;
	}
}
