/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tableDesignerEditor';
import { Designer } from 'sql/base/browser/ui/designer/designer';
import { attachDesignerStyler } from 'sql/platform/theme/common/styler';
import { TableDesignerInput } from 'sql/workbench/browser/editor/tableDesigner/tableDesignerInput';
import *  as DOM from 'vs/base/browser/dom';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { SaveTableChangesAction } from 'sql/workbench/contrib/tableDesigner/browser/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { DesignerPaneSeparator } from 'sql/platform/theme/common/colorRegistry';

export class TableDesignerEditor extends EditorPane {
	public static readonly ID: string = 'workbench.editor.tableDesigner';

	private _designer: Designer;
	private _saveChangesAction: SaveTableChangesAction;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IStorageService storageService: IStorageService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(TableDesignerEditor.ID, telemetryService, themeService, storageService);
	}

	public override get input(): TableDesignerInput | undefined {
		return this._input as TableDesignerInput;
	}

	override async setInput(input: TableDesignerInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		const designerInput = input.getComponentInput();
		this._designer.setInput(designerInput);
		this._saveChangesAction.setContext(designerInput);
	}

	protected createEditor(parent: HTMLElement): void {
		// The editor is only created once per editor group.
		const container = parent.appendChild(DOM.$('.table-designer-main-container'));
		const actionbarContainer = container.appendChild(DOM.$('.actionbar-container'));
		const designerContainer = container.appendChild(DOM.$('.designer-container'));
		const actionbar = new ActionBar(actionbarContainer);
		this._register(actionbar);
		this._saveChangesAction = this._instantiationService.createInstance(SaveTableChangesAction);
		this._saveChangesAction.enabled = false;
		actionbar.push(this._saveChangesAction, { icon: true, label: false });
		this._designer = new Designer(designerContainer, this._contextViewService);
		this._register(attachDesignerStyler(this._designer, this.themeService));
		this._register(registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
			const border = theme.getColor(DesignerPaneSeparator);
			if (border) {
				collector.addRule(`.table-designer-main-container .actionbar-container { border-color: ${border};}`);
			}
		}));
	}

	layout(dimension: DOM.Dimension): void {
		this._designer.layout(dimension);
	}
}
