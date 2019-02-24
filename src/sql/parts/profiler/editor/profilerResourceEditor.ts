/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { TPromise } from 'vs/base/common/winjs.base';
import { ResourceEditorModel } from 'vs/workbench/common/editor/resourceEditorModel';
import * as editorCommon from 'vs/editor/common/editorCommon';

import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { EditorOptions } from 'vs/workbench/common/editor';
import { IEditorContributionCtor } from 'vs/editor/browser/editorExtensions';
import { FoldingController } from 'vs/editor/contrib/folding/folding';
import { StandaloneCodeEditor } from 'vs/editor/standalone/browser/standaloneCodeEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IWindowService } from 'vs/platform/windows/common/windows';

class ProfilerResourceCodeEditor extends StandaloneCodeEditor {

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
		@ITextFileService textFileService: ITextFileService,
		@IEditorService protected editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IWindowService windowService: IWindowService

	) {
		super(ProfilerResourceEditor.ID, telemetryService, instantiationService, storageService, configurationService, themeService, textFileService, editorService, editorGroupService, windowService);
	}

	public createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		return this.instantiationService.createInstance(ProfilerResourceCodeEditor, parent, configuration);
	}

	protected getConfigurationOverrides(): IEditorOptions {
		const options = super.getConfigurationOverrides();
		options.readOnly = true;
		if (this.input) {
			options.inDiffEditor = true;
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

	setInput(input: UntitledEditorInput, options: EditorOptions): Thenable<void> {
		return super.setInput(input, options, CancellationToken.None)
			.then(() => this.input.resolve()
				.then(editorModel => editorModel.load())
				.then(editorModel => this.getControl().setModel((<ResourceEditorModel>editorModel).textEditorModel)));
	}

	protected getAriaLabel(): string {
		return nls.localize('profilerTextEditorAriaLabel', 'Profiler editor for event text. Readonly');
	}

	public layout(dimension: DOM.Dimension) {
		this.getControl().layout(dimension);
	}
}
