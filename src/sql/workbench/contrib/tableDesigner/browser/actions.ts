/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDesignerComponentInput } from 'sql/workbench/services/tableDesigner/browser/tableDesignerComponentInput';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ThemeIcon } from 'vs/base/common/themables';
import { localize } from 'vs/nls';

const PublishChangesLabel = localize('tableDesigner.publishTableChanges', "Publish Changes...");
const SaveChangesLabel = localize('tableDesigner.saveTableChanges', "Save");

export class SaveTableChangesAction extends Action {
	public static ID = 'tableDesigner.publishTableChanges';
	protected _input: TableDesignerComponentInput;
	protected _inputDisposableStore: DisposableStore;

	constructor() {
		super(SaveTableChangesAction.ID);
		this._inputDisposableStore = new DisposableStore();
	}

	public setContext(input: TableDesignerComponentInput): void {
		this._input = input;
		this.updateState();
		this.updateLabelAndIcon();
		this._inputDisposableStore?.dispose();
		this._inputDisposableStore = new DisposableStore();
		this._inputDisposableStore.add(input.onStateChange((e) => {
			this.updateState();
		}));
		this._inputDisposableStore.add(input.onInitialized(() => {
			this.updateLabelAndIcon();
		}));
	}

	private updateState(): void {
		this.enabled = this._input.dirty && this._input.valid && this._input.pendingAction === undefined;
	}

	private updateLabelAndIcon(): void {
		if (this._input?.tableDesignerView?.useAdvancedSaveMode) {
			this.label = PublishChangesLabel;
			this.class = ThemeIcon.asClassName(Codicon.repoPush);
		} else {
			this.label = SaveChangesLabel;
			this.class = ThemeIcon.asClassName(Codicon.save);
		}
	}

	public override async run(): Promise<void> {
		await this._input.save();
	}

	override dispose() {
		super.dispose();
		this._inputDisposableStore?.dispose();
	}
}
