/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/executionPlan';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ExecutionPlanComparisonInput } from 'sql/workbench/contrib/executionPlan/browser/compareExecutionPlanInput';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ExecutionPlanComparisonEditorView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonEditorView';


export class ExecutionPlanComparisonEditor extends EditorPane {
	public static ID: string = 'workbench.editor.compareExecutionPlan';
	public static LABEL: string = localize('compareExecutionPlanEditor', "Compare Execution Plan Editor");

	private _editorContainer: HTMLElement;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IContextViewService readonly contextViewService: IContextViewService
	) {
		super(ExecutionPlanComparisonEditor.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._editorContainer = DOM.$('.eps-container');
		parent.appendChild(this._editorContainer);
	}

	public override get input(): ExecutionPlanComparisonInput {
		return <ExecutionPlanComparisonInput>super.input;
	}

	layout(dimension: DOM.Dimension): void {
		this._editorContainer.style.width = dimension.width + 'px';
		this._editorContainer.style.height = dimension.height + 'px';
	}

	public override async setInput(input: ExecutionPlanComparisonInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		const oldInput = this.input as ExecutionPlanComparisonInput;

		// returning when new input is the same as current input
		if (oldInput && input.matches(oldInput)) {
			return Promise.resolve();
		}

		super.setInput(input, options, context, token);

		// removing existing comparison containers
		while (this._editorContainer.firstChild) {
			this._editorContainer.removeChild(this._editorContainer.firstChild);
		}

		// creating a new comparison view if the new input does not already have a cached one.
		if (!input._executionPlanComparisonView) {
			input._executionPlanComparisonView = this._register(this._instantiationService.createInstance(ExecutionPlanComparisonEditorView, this._editorContainer));

			if (this.input.preloadModel) {
				if (this.input.preloadModel.topExecutionPlan) {
					input._executionPlanComparisonView.addExecutionPlanGraph(this.input.preloadModel.topExecutionPlan, this.input.preloadModel.topPlanIndex);
				}
				if (this.input.preloadModel.bottomExecutionPlan) {
					input._executionPlanComparisonView.addExecutionPlanGraph(this.input.preloadModel.bottomExecutionPlan, this.input.preloadModel.bottomPlanIndex);
				}
			}
		} else { // Getting the cached comparison view from the input and adding it to the base editor node.
			this._editorContainer.appendChild(input._executionPlanComparisonView.container);
		}
	}
}


