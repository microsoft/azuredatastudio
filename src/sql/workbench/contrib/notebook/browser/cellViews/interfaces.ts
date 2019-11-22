/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnDestroy } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { ICellEditorProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { NotebookRange } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';

export abstract class CellView extends AngularDisposable implements OnDestroy, ICellEditorProvider {
	constructor() {
		super();
	}

	public abstract layout(): void;

	public abstract getEditor(): BaseTextEditor;

	public abstract hasEditor(): boolean;

	public abstract cellGuid(): string;

	public deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {

	}
}
