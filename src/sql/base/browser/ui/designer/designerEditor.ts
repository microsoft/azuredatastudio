/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import * as nls from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { TextResourceEditorModel } from 'vs/workbench/common/editor/textResourceEditorModel';
import * as editorCommon from 'vs/editor/common/editorCommon';

import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { Event, Emitter } from 'vs/base/common/event';
import { IView } from 'vs/base/browser/ui/splitview/splitview';
import { clamp } from 'vs/base/common/numbers';

export class BasicView implements IView {
	public get element(): HTMLElement {
		return this._element;
	}
	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	private _collapsed = false;
	private size: number;
	private previousSize: number;
	private _minimumSize: number;
	public get minimumSize(): number {
		return this._minimumSize;
	}

	private _maximumSize: number;
	public get maximumSize(): number {
		return this._maximumSize;
	}

	constructor(
		private _defaultMinimumSize: number,
		private _defaultMaximumSize: number,
		private _layout: (size: number) => void,
		private _element: HTMLElement,
		private options: { headersize?: number } = {}
	) {
		this._minimumSize = _defaultMinimumSize;
		this._maximumSize = _defaultMaximumSize;
	}

	public layout(size: number): void {
		this.size = size;
		this._layout(size);
	}

	public set collapsed(val: boolean) {
		if (val !== this._collapsed && this.options.headersize) {
			this._collapsed = val;
			if (this.collapsed) {
				this.previousSize = this.size;
				this._minimumSize = this.options.headersize;
				this._maximumSize = this.options.headersize;
				this._onDidChange.fire(undefined);
			} else {
				this._maximumSize = this._defaultMaximumSize;
				this._minimumSize = this._defaultMinimumSize;
				this._onDidChange.fire(clamp(this.previousSize, this.minimumSize, this.maximumSize));
			}
		}
	}

	public get collapsed(): boolean {
		return this._collapsed;
	}
}

class DesignerCodeEditor extends CodeEditorWidget {
}

/**
 * Extension of TextResourceEditor that is always readonly rather than only with non UntitledInputs
 */
export class DesignerEditor extends BaseTextEditor {

	public static ID = 'designer.editors.textEditor';
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@ITextResourceConfigurationService configurationService: ITextResourceConfigurationService,
		@IThemeService themeService: IThemeService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService

	) {
		super(DesignerEditor.ID, telemetryService, instantiationService, storageService, configurationService, themeService, editorService, editorGroupService);
	}

	public override createEditorControl(parent: HTMLElement, configuration: IEditorOptions): editorCommon.IEditor {
		return this.instantiationService.createInstance(DesignerCodeEditor, parent, configuration, {});
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

	override async setInput(input: UntitledTextEditorInput, options: ITextEditorOptions, context: IEditorOpenContext): Promise<void> {
		await super.setInput(input, options, context, CancellationToken.None);
		const editorModel = await this.input.resolve() as TextResourceEditorModel;
		await editorModel.resolve();
		this.getControl().setModel(editorModel.textEditorModel);
	}

	protected getAriaLabel(): string {
		return nls.localize('designerTextEditorAriaLabel', "Designer editor for event text. Readonly");
	}

	public override layout(dimension: DOM.Dimension) {
		this.getControl().layout(dimension);
	}
}
