/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IListRenderer, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { PickerListTemplate } from 'sql/workbench/services/accountManagement/browser/accountListRenderer';
import * as DOM from 'vs/base/browser/dom';

export interface Tenant {
	id: string;
	displayName: string;
}

export interface TenantPickerListTemplate extends PickerListTemplate {
}

export class TenantListDelegate implements IListVirtualDelegate<Tenant> {

	constructor(
		private _height: number
	) {
	}

	public getHeight(element: Tenant): number {
		return this._height;
	}

	public getTemplateId(element: Tenant): string {
		return 'tenantListRenderer';
	}
}

export class TenantPickerListRenderer implements IListRenderer<Tenant, TenantPickerListTemplate> {
	public static TEMPLATE_ID = 'tenantListRenderer';

	public get templateId(): string {
		return TenantPickerListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): TenantPickerListTemplate {
		const tableTemplate: TenantPickerListTemplate = Object.create(null);
		tableTemplate.root = DOM.append(container, DOM.$('div.list-row.tenant-picker-list'));
		tableTemplate.label = DOM.append(tableTemplate.root, DOM.$('div.label'));
		tableTemplate.displayName = DOM.append(tableTemplate.label, DOM.$('div.display-name'));
		return tableTemplate;
	}

	public renderElement(tenant: Tenant, index: number, templateData: PickerListTemplate): void {
		templateData.displayName.innerText = tenant.displayName;
	}

	public disposeTemplate(template: PickerListTemplate): void {
		// noop
	}

	public disposeElement(element: Tenant, index: number, templateData: PickerListTemplate): void {
		// noop
	}
}

export class TenantListRenderer extends TenantPickerListRenderer {
	constructor(
	) {
		super();
	}

	public get templateId(): string {
		return TenantPickerListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): PickerListTemplate {
		const tableTemplate = super.renderTemplate(container) as PickerListTemplate;
		tableTemplate.content = DOM.append(tableTemplate.label, DOM.$('div.content'));

		return tableTemplate;
	}

	public renderElement(tenant: Tenant, index: number, templateData: PickerListTemplate): void {
		super.renderElement(tenant, index, templateData);
	}
}
