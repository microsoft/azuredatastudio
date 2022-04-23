/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDesignerComponentInput } from 'sql/workbench/services/tableDesigner/browser/tableDesignerComponentInput';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { IDisposable } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';

export class SaveTableChangesAction extends Action {
	public static ID = 'tableDesigner.saveTableChanges';
	public static LABEL = localize('tableDesigner.saveTableChanges', "Save Changes");
	private _input: TableDesignerComponentInput;
	private _onStateChangeDisposable: IDisposable;

	constructor(
	) {
		super(SaveTableChangesAction.ID, SaveTableChangesAction.LABEL, Codicon.save.classNames);
	}

	public setContext(input: TableDesignerComponentInput): void {
		this._input = input;
		this.updateState();
		this._onStateChangeDisposable?.dispose();
		this._onStateChangeDisposable = input.onStateChange((e) => {
			this.updateState();
		});
	}

	public override async run(): Promise<void> {
		await this._input.save();
	}

	private updateState(): void {
		this.enabled = this._input.dirty && this._input.valid && !this._input.processing;
	}

	override dispose() {
		super.dispose();
		this._onStateChangeDisposable?.dispose();
	}
}
