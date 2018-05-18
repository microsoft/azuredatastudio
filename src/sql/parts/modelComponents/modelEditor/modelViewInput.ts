/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput } from 'vs/workbench/common/editor';

export class ModelViewInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.ModelViewEditorInput';

	constructor(private _title: string, private _modelViewId: string) {
		super();
	}

	public get title(): string {
		return this._title;
	}

	public get modelViewId(): string {
		return this._modelViewId;
	}

	public getTypeId(): string {
		return 'ModelViewEditorInput';
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return this._title;
	}
}
