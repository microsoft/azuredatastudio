/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Designer } from 'sql/base/browser/ui/designer/designer';
import { attachDesignerStyler } from 'sql/platform/theme/common/styler';
import { TableDesignerInput } from 'sql/workbench/browser/editor/tableDesigner/tableDesignerInput';
import *  as DOM from 'vs/base/browser/dom';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

export class TableDesignerEditor extends EditorPane {
	public static readonly ID: string = 'workbench.editor.tableDesigner';

	private _designer: Designer;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IStorageService storageService: IStorageService,
		@IContextViewService private _contextViewService: IContextViewService
	) {
		super(TableDesignerEditor.ID, telemetryService, themeService, storageService);
	}

	public override get input(): TableDesignerInput | undefined {
		return this._input as TableDesignerInput;
	}

	override async setInput(input: TableDesignerInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this._designer.setInput(input.getComponentInput());
	}

	protected createEditor(parent: HTMLElement): void {
		// The editor is only created once per editor group.
		this._designer = new Designer(parent, this._contextViewService);
		this._register(attachDesignerStyler(this._designer, this.themeService));
	}

	layout(dimension: DOM.Dimension): void {
		this._designer.layout(dimension);
	}
}
