/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/editor';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy
} from '@angular/core';

import * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ResourceEditorInput } from 'vs/workbench/common/editor/resourceEditorInput';
import { URI } from 'vs/base/common/uri';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { TextDiffEditor } from 'vs/workbench/browser/parts/editor/textDiffEditor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { TextDiffEditorModel } from 'vs/workbench/common/editor/textDiffEditorModel';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { ITextModel } from 'vs/editor/common/model';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { SimpleProgressIndicator } from 'sql/workbench/services/progress/browser/simpleProgressIndicator';
import { IEditorProgressService } from 'vs/platform/progress/common/progress';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { convertSizeToNumber } from 'sql/base/browser/dom';

@Component({
	template: `
	<div *ngIf="_title">
		<div class="modelview-diff-editor-title modelview-diff-editor-title-background">
			{{_title}}
		</div>
	</div>`,
	selector: 'modelview-diff-editor-component'
})
export default class DiffEditorComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _editor: TextDiffEditor;
	private _editorInput: DiffEditorInput;
	private _editorModel: TextDiffEditorModel;
	private _renderedContentLeft: string;
	private _renderedContentRight: string;
	private _languageMode: string;
	private _isAutoResizable: boolean;
	private _minimumHeight: number;
	protected _title: string;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService,
		@Inject(ITextModelService) private _textModelService: ITextModelService
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
		this._createEditor();
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.layout();
		}));
	}

	private _createEditor(): void {
		const customInstan = this._instantiationService.createChild(new ServiceCollection([IEditorProgressService, new SimpleProgressIndicator()]));
		this._editor = customInstan.createInstance(TextDiffEditor);
		this._editor.reverseColoring();
		this._editor.create(this._el.nativeElement);
		this._editor.setVisible(true);
		let uri1 = this.createUri('source');
		this.editorUriLeft = uri1.toString();
		let uri2 = this.createUri('target');
		this.editorUriRight = uri2.toString();

		let cancellationTokenSource = new CancellationTokenSource();
		let textModelContentProvider = this._textModelService.registerTextModelContentProvider('sqlDiffEditor', {
			provideTextContent: (resource: URI): Promise<ITextModel> => {
				let modelContent = '';
				let languageSelection = this._modeService.create('plaintext');
				return Promise.resolve(this._modelService.createModel(modelContent, languageSelection, resource));
			}
		});

		let editorinput1 = this._instantiationService.createInstance(ResourceEditorInput, uri1, 'source', undefined, undefined);
		let editorinput2 = this._instantiationService.createInstance(ResourceEditorInput, uri2, 'target', undefined, undefined);
		this._editorInput = new DiffEditorInput('DiffEditor', undefined, editorinput1, editorinput2, true);
		this._editor.setInput(this._editorInput, undefined, cancellationTokenSource.token);


		this._editorInput.resolve().then(model => {
			this._editorModel = model as TextDiffEditorModel;
			this.updateModel();
			this.layout();
			this.validate();
		});

		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel);
		this._register(textModelContentProvider);
	}

	private createUri(input: string): URI {
		let uri = URI.from({ scheme: 'sqlDiffEditor', path: `${this.descriptor.type}-${this.descriptor.id}-${input}` });
		return uri;
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		let width: number = convertSizeToNumber(this.width);
		let height: number = convertSizeToNumber(this.height);
		if (this._isAutoResizable) {
			height = Math.max(this._editor.maximumHeight, this._minimumHeight ? this._minimumHeight : 0);
		}
		this._editor.layout(new DOM.Dimension(
			width && width > 0 ? width : DOM.getContentWidth(this._el.nativeElement),
			height && height > 0 ? height : DOM.getContentHeight(this._el.nativeElement)));
		let element = <HTMLElement>this._el.nativeElement;
		element.style.position = this.position;

		super.layout();
	}

	/// Editor Functions

	private updateModel() {
		if (this._editorModel) {
			this._renderedContentLeft = this.contentLeft;
			this._renderedContentRight = this.contentRight;
			this._modelService.updateModel(this._editorModel.originalModel.textEditorModel, this._renderedContentLeft);
			this._modelService.updateModel(this._editorModel.modifiedModel.textEditorModel, this._renderedContentRight);
		}
	}

	private updateLanguageMode() {
		if (this._editorModel && this._editor) {
			this._languageMode = this.languageMode;
			let languageSelection = this._modeService.create(this._languageMode);
			this._modelService.setMode(this._editorModel.originalModel.textEditorModel, languageSelection);
			this._modelService.setMode(this._editorModel.modifiedModel.textEditorModel, languageSelection);
		}
	}

	/// IComponent implementation
	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.contentLeft !== this._renderedContentLeft || this.contentRight !== this._renderedContentRight) {
			this.updateModel();
		}
		if (this.languageMode !== this._languageMode) {
			this.updateLanguageMode();
		}
		this._isAutoResizable = this.isAutoResizable;
		this._minimumHeight = this.minimumHeight;
		this._title = this.title;
		this.layout();
		this.validate();
	}

	// CSS-bound properties
	public get contentLeft(): string {
		return this.getPropertyOrDefault<azdata.EditorProperties, string>((props) => props.contentLeft, undefined);
	}

	public set contentLeft(newValue: string) {
		this.setPropertyFromUI<azdata.EditorProperties, string>((properties, contentLeft) => { properties.contentLeft = contentLeft; }, newValue);
	}

	public get contentRight(): string {
		return this.getPropertyOrDefault<azdata.EditorProperties, string>((props) => props.contentRight, undefined);
	}

	public set contentRight(newValue: string) {
		this.setPropertyFromUI<azdata.EditorProperties, string>((properties, contentRight) => { properties.contentRight = contentRight; }, newValue);
	}

	public get languageMode(): string {
		return this.getPropertyOrDefault<azdata.EditorProperties, string>((props) => props.languageMode, undefined);
	}

	public set languageMode(newValue: string) {
		this.setPropertyFromUI<azdata.EditorProperties, string>((properties, languageMode) => { properties.languageMode = languageMode; }, newValue);
	}

	public get isAutoResizable(): boolean {
		return this.getPropertyOrDefault<azdata.EditorProperties, boolean>((props) => props.isAutoResizable, false);
	}

	public set isAutoResizable(newValue: boolean) {
		this.setPropertyFromUI<azdata.EditorProperties, boolean>((properties, isAutoResizable) => { properties.isAutoResizable = isAutoResizable; }, newValue);
	}

	public get minimumHeight(): number {
		return this.getPropertyOrDefault<azdata.EditorProperties, number>((props) => props.minimumHeight, this._editor.minimumHeight);
	}

	public set minimumHeight(newValue: number) {
		this.setPropertyFromUI<azdata.EditorProperties, number>((properties, minimumHeight) => { properties.minimumHeight = minimumHeight; }, newValue);
	}

	public get editorUriLeft(): string {
		return this.getPropertyOrDefault<azdata.EditorProperties, string>((props) => props.editorUriLeft, '');
	}

	public set editorUriLeft(newValue: string) {
		this.setPropertyFromUI<azdata.EditorProperties, string>((properties, editorUriLeft) => { properties.editorUriLeft = editorUriLeft; }, newValue);
	}

	public get editorUriRight(): string {
		return this.getPropertyOrDefault<azdata.EditorProperties, string>((props) => props.editorUriRight, '');
	}

	public set editorUriRight(newValue: string) {
		this.setPropertyFromUI<azdata.EditorProperties, string>((properties, editorUriRight) => { properties.editorUriRight = editorUriRight; }, newValue);
	}

	public get title(): string {
		return this.getPropertyOrDefault<azdata.EditorProperties, string>((props) => props.title, undefined);
	}

	public set title(newValue: string) {
		this.setPropertyFromUI<azdata.EditorProperties, string>((properties, title) => { properties.title = title; }, newValue);
	}
}
