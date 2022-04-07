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
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { ExecutionPlanView } from 'sql/workbench/contrib/executionPlan/browser/executionPlan';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class ExecutionPlanEditor extends EditorPane {

	public static ID: string = 'workbench.editor.executionplan';
	public static LABEL: string = localize('executionPlanEditor', "Query Execution Plan Editor");

	private view: ExecutionPlanView;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
	) {
		super(ExecutionPlanEditor.ID, telemetryService, themeService, storageService);
		this.view = this._register(instantiationService.createInstance(ExecutionPlanView));
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		//Enable scrollbars when drawing area is larger than viewport
		parent.style.overflow = 'auto';
		this.view.render(parent);
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this.view.layout(dimension);
	}

	public override async setInput(input: ExecutionPlanInput, options: IEditorOptions, context: IEditorOpenContext): Promise<void> {
		if (this.input instanceof ExecutionPlanInput && this.input.matches(input)) {
			return Promise.resolve(undefined);
		}
		await input.resolve();
		await super.setInput(input, options, context, CancellationToken.None);
		this.view.loadGraphFile({
			graphFileContent: input.content,
			graphFileType: input.getFileExtension().replace('.', '')
		});
	}
}
