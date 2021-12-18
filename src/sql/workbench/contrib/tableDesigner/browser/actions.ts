/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDesignerComponentInput } from 'sql/workbench/services/tableDesigner/browser/tableDesignerComponentInput';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { IDisposable } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';

export abstract class SaveTableChangesActionBase extends Action {
	protected _input: TableDesignerComponentInput;
	private _onStateChangeDisposable: IDisposable;

	constructor(id: string, label: string, iconClassNames: string) {
		super(id, label, iconClassNames);
	}

	public setContext(input: TableDesignerComponentInput): void {
		this._input = input;
		this.updateState();
		this._onStateChangeDisposable?.dispose();
		this._onStateChangeDisposable = input.onStateChange((e) => {
			this.updateState();
		});
	}

	private updateState(): void {
		this.enabled = this._input.dirty && this._input.valid && this._input.pendingAction === undefined;
	}

	override dispose() {
		super.dispose();
		this._onStateChangeDisposable?.dispose();
	}
}

export class SaveTableChangesAction extends SaveTableChangesActionBase {
	public static ID = 'tableDesigner.saveTableChanges';
	public static LABEL = localize('tableDesigner.saveTableChanges', "Save Changes...");
	constructor() {
		super(SaveTableChangesAction.ID, SaveTableChangesAction.LABEL, Codicon.save.classNames);
	}

	public override async run(): Promise<void> {
		await this._input.save();
	}
}

export class GenerateTableChangeScriptAction extends SaveTableChangesActionBase {
	public static ID = 'tableDesigner.generateScript';
	public static LABEL = localize('tableDesigner.generateScript', "Generate Script");

	constructor() {
		super(GenerateTableChangeScriptAction.ID, GenerateTableChangeScriptAction.LABEL, Codicon.output.classNames);
	}

	public override async run(): Promise<void> {
		await this._input.generateScript();
	}
}
