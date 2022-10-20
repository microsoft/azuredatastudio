/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ExecutionPlanInput } from 'sql/workbench/contrib/executionPlan/common/executionPlanInput';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ExecutionPlanFileView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileView';
import { generateUuid } from 'vs/base/common/uuid';
import { ExecutionPlanFileViewCache } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileViewCache';

export class ExecutionPlanEditor extends EditorPane {

	public static ID: string = 'workbench.editor.executionplan';
	public static LABEL: string = localize('executionPlanEditor', "Query Execution Plan Editor");

	private _viewCache: ExecutionPlanFileViewCache = ExecutionPlanFileViewCache.getInstance();

	private _parentContainer: HTMLElement;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
	) {
		super(ExecutionPlanEditor.ID, telemetryService, themeService, storageService);
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		this._parentContainer = parent;
		//Enable scrollbars when drawing area is larger than viewport
		parent.style.overflow = 'auto';
	}

	public layout(dimension: DOM.Dimension): void {
	}

	override clearInput(): void {
		const currentInput = this.input as ExecutionPlanInput;

		// clearing old input view if present in the editor
		if (currentInput?._executionPlanFileViewUUID) {
			const oldView = this._viewCache.executionPlanFileViewMap.get(currentInput._executionPlanFileViewUUID);
			oldView.onHide(this._parentContainer);
		}

		super.clearInput();
	}

	public override async setInput(newInput: ExecutionPlanInput, options: IEditorOptions, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		const oldInput = this.input as ExecutionPlanInput;

		// returning if the new input is same as old input
		if (oldInput && newInput.matches(oldInput)) {
			return Promise.resolve();
		}

		super.setInput(newInput, options, context, token);

		// clearing old input view if present in the editor
		if (oldInput?._executionPlanFileViewUUID) {
			const oldView = this._viewCache.executionPlanFileViewMap.get(oldInput._executionPlanFileViewUUID);
			oldView.onHide(this._parentContainer);
		}

		// if new input already has a view we are just making it visible here.
		let newView = this._viewCache.executionPlanFileViewMap.get(newInput.executionPlanFileViewUUID);
		if (newView) {
			newView.onShow(this._parentContainer);
		} else {
			// creating a new view for the new input
			newInput._executionPlanFileViewUUID = generateUuid();
			newView = this._register(this._instantiationService.createInstance(ExecutionPlanFileView, undefined));
			newView.onShow(this._parentContainer);
			newView.loadGraphFile({
				graphFileContent: await newInput.content(),
				graphFileType: newInput.getFileExtension().replace('.', '')
			});
			this._viewCache.executionPlanFileViewMap.set(newInput._executionPlanFileViewUUID, newView);
		}
	}
}
