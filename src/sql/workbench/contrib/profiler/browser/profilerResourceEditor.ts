/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { ResourceEditorModel } from 'vs/workbench/common/editor/resourceEditorModel';
import * as editorCommon from 'vs/editor/common/editorCommon';

import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { EditorOptions, IEditorOpenContext } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';

class ProfilerResourceCodeEditor extends CodeEditorWidget {

	// protected _getContributions(): IEditorContributionCtor[] {
	// 	let contributions = super._getContributions();
	// 	let skipContributions = [FoldingController.prototype];
	// 	contributions = contributions.filter(c => skipContributions.indexOf(c.prototype) === -1);
	// 	return contributions;
	// }

}

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class ProfilerResourceEditor extends BaseTextEditor {

	public static ID = 'profiler.editors.textEditor';
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService

	) {
		super(ProfilerResourceEditor.ID, telemetryService, instantiationService, storageService, configurationService, themeService, editorService, editorGroupService);
	}

	public override createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		return this.instantiationService.createInstance(ProfilerResourceCodeEditor, parent, configuration, {});
	}

	protected override getConfigurationOverrides(): IEditorOptions {
		const options = super.getConfigurationOverrides();
		options.readOnly = true;
		if (this.input) {
			options.inDiffEditor = false;
			options.scrollBeyondLastLine = false;
			options.folding = false;
			options.renderWhitespace = 'none';
			options.wordWrap = 'on';
			options.renderIndentGuides = false;
			options.rulers = [];
			options.glyphMargin = true;
			options.minimap = {
				enabled: false
			};
		}
		return options;
	}

	override async setInput(input: UntitledTextEditorInput, options: EditorOptions, context: IEditorOpenContext): Promise<void> {
		await super.setInput(input, options, context, CancellationToken.None);
		const editorModel = await this.input.resolve() as ResourceEditorModel;
		await editorModel.resolve();
		this.getControl().setModel(editorModel.textEditorModel);
	}

	protected getAriaLabel(): string {
		return nls.localize('profilerTextEditorAriaLabel', "Profiler editor for event text. Readonly");
	}

	public override layout(dimension: DOM.Dimension) {
		this.getControl().layout(dimension);
	}
}
