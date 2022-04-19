/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/executionPlan';
import { localize } from 'vs/nls';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import * as DOM from 'vs/base/browser/dom';
import { ExecutionPlanComparisonInput } from 'sql/workbench/contrib/executionPlan/common/compareExecutionPlanInput';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ExecutionPlanFileViewCache } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileViewCache';
import { generateUuid } from 'vs/base/common/uuid';
import { ExecutionPlanComparisonEditorView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonEditorView';

export class ExecutionPlanComparisonEditor extends EditorPane {
	private _container: HTMLElement;

	public static ID: string = 'workbench.editor.compareExecutionPlan';
	public static LABEL: string = localize('compareExecutionPlanEditor', "Compare Execution Plan Editor");

	private _viewCache: ExecutionPlanFileViewCache = ExecutionPlanFileViewCache.getInstance();

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IExecutionPlanService public executionPlanService: IExecutionPlanService,
		@IFileDialogService public fileDialogService: IFileDialogService,
		@ITextFileService public textFileService: ITextFileService,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(ExecutionPlanComparisonEditor.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		// creating the parent container for the editor
		this._container = DOM.$('.compare-execution-plan-parent-editor');
		parent.appendChild(this._container);
	}

	layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}

	public override async setInput(newInput: ExecutionPlanComparisonInput, options: IEditorOptions, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		const oldInput = this.input as ExecutionPlanComparisonInput;

		if (oldInput && newInput.matches(oldInput)) {
			return Promise.resolve();
		}

		super.setInput(newInput, options, context, token);

		if (oldInput?._comparisonEditorUUID) {
			const oldView = this._viewCache.executionPlanComparisonViewMap.get(oldInput._comparisonEditorUUID);
			if (oldView) {
				oldView.hide();
			}
		}

		let newView = this._viewCache.executionPlanComparisonViewMap.get(newInput._comparisonEditorUUID);

		if (newView) {
			newView.show();
		} else {
			newInput._comparisonEditorUUID = generateUuid();
			newView = this._instantiationService.createInstance(ExecutionPlanComparisonEditorView, this._container);
			this._viewCache.executionPlanComparisonViewMap.set(newInput._comparisonEditorUUID, newView);
		}
	}
}
