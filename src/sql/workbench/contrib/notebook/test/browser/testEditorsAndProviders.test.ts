/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotebookEditorStub, CellEditorProviderStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestTextResourceConfigurationService, TestEditorGroupsService, TestEditorService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import * as dom from 'vs/base/browser/dom';

export class TestNotebookEditor extends NotebookEditorStub {
	constructor(private _cellGuid?: string, private _instantiationService?: IInstantiationService) {
		super();
	}
	cellEditors: CellEditorProviderStub[] = [new TestCellEditorProvider(this._cellGuid, this._instantiationService)];
}

class TestCellEditorProvider extends CellEditorProviderStub {
	private _editor: QueryTextEditor;
	private _cellGuid: string;
	constructor(cellGuid: string, instantiationService?: IInstantiationService) {
		super();
		let div = dom.$('div', undefined, dom.$('span', { id: 'demospan' }));
		let firstChild = div.firstChild as HTMLElement;

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
		this._editor.create(firstChild);
		this._cellGuid = cellGuid;
	}
	cellGuid(): string {
		return this._cellGuid;
	}
	getEditor(): QueryTextEditor {
		return this._editor;
	}
}
