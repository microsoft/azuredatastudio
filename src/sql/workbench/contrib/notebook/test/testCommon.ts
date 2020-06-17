/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { CellEditorProviderStub, NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/stubs';
import * as dom from 'vs/base/browser/dom';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestEditorGroupsService, TestEditorService, TestTextResourceConfigurationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';

// Typically you will pass in either editor or the instantiationService parameter.
// Leave both undefined when you want the underlying object(s) to have an undefined editor.
export class TestNotebookEditor extends NotebookEditorStub {
	cellEditors: CellEditorProviderStub[];
	// Normally one needs to provide either the editor or the instantiationService as the constructor parameter
	constructor({ cellGuid, instantiationService, editor }: { cellGuid?: string; instantiationService?: IInstantiationService; editor?: QueryTextEditor; } = {}) {
		super();
		this.cellEditors = [new TestCellEditorProvider({ cellGuid: cellGuid, instantiationService: instantiationService, editor: editor })];
	}
}

// Typically you will pass in either editor or the instantiationService parameter.
// Leave both undefined when you want the underlying object to have an undefined editor.
class TestCellEditorProvider extends CellEditorProviderStub {
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
				new TestEditorService(),
				new TestConfigurationService()
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
