/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./../media/filterDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Modal } from 'sql/workbench/browser/modal/modal'
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { attachButtonStyler, attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import * as DOM from 'vs/base/browser/dom';
import * as azdata from 'azdata';
import { AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ITree } from 'sql/base/parts/tree/browser/tree';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';

function FilterDialogTitle(nodePath: string): string { return localize('objectExplorer.filterDialogTitle', "Filter Settings: {0}", nodePath) }
const OkButtonText = localize('objectExplorer.okButtonText', "OK");
const CancelButtonText = localize('objectExplorer.cancelButtonText', "Cancel");
const TitleIconClass: string = 'icon filterLabel';

export class ObjectExplorerServiceDialog extends Modal {

	private _clauseBuilder?: HTMLElement;
	private _okButton?: Button;
	private _cancelButton?: Button;

	constructor(
		private _treeNode: TreeNode,
		private _tree: AsyncServerTree | ITree,
		@IThemeService themeService: IThemeService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@ILayoutService layoutService: ILayoutService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextViewService private _contextViewService: IContextViewService
	) {
		super(
			'ObjectExplorerServiceDialog',
			'Object Explorer Service Dialog',
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'normal',
				hasTitleIcon: true
			}
		);
	}

	public open(): void {
		this.render();
		this.show();
		this._okButton.focus();
	}

	public override render() {
		super.render();
		this.title = FilterDialogTitle(this._treeNode.nodePath);
		this.titleIconClassName = TitleIconClass;
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(OkButtonText, () => { this.onAccept() });
		this._cancelButton = this.addFooterButton(CancelButtonText, () => { this.onClose() });
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
	}

	protected renderBody(container: HTMLElement): void {
		const body = DOM.append(container, DOM.$('.filter-dialog-body'));
		const clauseTableContainer = DOM.append(body, DOM.$('.clause-table-container'));
		this._clauseBuilder = DOM.append(clauseTableContainer, DOM.$('.clause-table'));

		const inputBox = new InputBox(this._clauseBuilder, this._contextViewService, {});
		inputBox.inputElement.type = 'date';
		this._register(attachInputBoxStyler(inputBox, this._themeService));
		const headerRow = DOM.append(this._clauseBuilder, DOM.$('tr'));
		DOM.append(headerRow, DOM.$('td').innerText = 'Property');
		DOM.append(headerRow, DOM.$('td').innerText = 'Operator');
		DOM.append(headerRow, DOM.$('td').innerText = 'Value');
		DOM.append(headerRow, DOM.$('td')).innerText = '';
		if (this._treeNode.filters) {
			this._treeNode.filters.forEach(filter => {
				this.addFilterRow(filter);
			});
		}
	}

	private addFilterRow(filter: azdata.NodeInfoFilterProperty): void {

	}

	protected layout(height?: number): void {
		// noop
	}

	protected override onClose() {
		this.hide('close');
	}

	private getFilters(): azdata.NodeInfoFilterProperty[] {
		return [];
	}

	protected override async onAccept() {
		this.hide('ok');
		this._treeNode.filters = this.getFilters();
		if (this._tree instanceof AsyncServerTree) {
			await this._tree.updateChildren(this._treeNode);
			await this._tree.expand(this._treeNode);
		} else {
			this._tree.refresh(this._treeNode);
		}
	}
}
