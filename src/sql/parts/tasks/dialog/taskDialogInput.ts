/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { EditorInput, EditorModel } from 'vs/workbench/common/editor';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export class TaskDialogInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.taskdialoginputs';
	public static SCHEMA: string = 'taskdialog';

	private _uniqueSelector: string;

	constructor(private _uri: string, private _connection: IConnectionProfile) {
		super();
	}

	public setUniqueSelector(uniqueSelector: string): void {
		this._uniqueSelector = uniqueSelector;
	}

	public getTypeId(): string {
		return UntitledEditorInput.ID;
	}

	public getName(): string {
		return this._connection.serverName + ':' + this._connection.databaseName;
	}

	public getUri(): string {
		return this._uri;
	}

	public supportsSplitEditor(): boolean {
		return false;
	}

	public getConnectionProfile(): IConnectionProfile {
		return this._connection;
	}

	public resolve(refresh?: boolean): TPromise<EditorModel> {
		return undefined;
	}

	public get hasInitialized(): boolean {
		return !!this._uniqueSelector;
	}

	public get uniqueSelector(): string {
		return this._uniqueSelector;
	}
}
