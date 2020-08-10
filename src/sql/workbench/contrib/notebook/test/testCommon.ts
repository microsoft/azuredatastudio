/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import * as stubs from 'sql/workbench/contrib/notebook/test/stubs';
import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookParams } from 'sql/workbench/services/notebook/browser/notebookService';
import * as dom from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestEditorGroupsService, TestEditorService, TestTextResourceConfigurationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';

// Typically you will pass in either editor or the instantiationService parameter.
// Leave both undefined when you want the underlying object(s) to have an undefined editor.
export class NotebookEditorStub extends stubs.NotebookEditorStub {
	cellEditors: CellEditorProviderStub[];
	model: INotebookModel | undefined;
	cells?: ICellModel[] = [];

	get id(): string {
		return this.notebookParams?.notebookUri?.toString();
	}

	get modelReady(): Promise<INotebookModel> {
		return Promise.resolve(this.model);
	}

	// Normally one needs to provide either the editor or the instantiationService as the constructor parameter
	constructor({ cellGuid, instantiationService, editor, model, notebookParams }: { cellGuid?: string; instantiationService?: IInstantiationService; editor?: QueryTextEditor; model?: INotebookModel, notebookParams?: INotebookParams } = {}) {
		super();
		this.model = model;
		this.notebookParams = notebookParams;
		this.cellEditors = [new CellEditorProviderStub({ cellGuid: cellGuid, instantiationService: instantiationService, editor: editor })];
	}
}

// Typically you will pass in either editor or the instantiationService parameter.
// Leave both undefined when you want the underlying object to have an undefined editor.
class CellEditorProviderStub extends stubs.CellEditorProviderStub {
	private _editor: QueryTextEditor;
	private _cellGuid: string;
	constructor({ cellGuid, instantiationService, editor }: { cellGuid: string; instantiationService?: IInstantiationService; editor?: QueryTextEditor; }) {
		super();
		if (editor) {
			this._editor = editor;
		} else if (instantiationService) {
			this._editor = new QueryTextEditor(
				NullTelemetryService,
				instantiationService,
				new TestStorageService(),
				new TestTextResourceConfigurationService(),
				new TestThemeService(),
				new TestEditorGroupsService(),
				new TestEditorService()
			);
		}
		if (this._editor) {
			let div = dom.$('div', undefined, dom.$('span', { id: 'demospan' }));
			let firstChild = div.firstChild as HTMLElement;
			this._editor.create(firstChild);
		}
		this._cellGuid = cellGuid;
	}
	cellGuid(): string {
		return this._cellGuid;
	}
	getEditor(): QueryTextEditor {
		return this._editor;
	}
}
