/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./editor';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList
} from '@angular/core';

import * as sqlops from 'sqlops';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { QueryTextEditor } from 'sql/parts/modelComponents/queryTextEditor';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { SimpleProgressService } from 'vs/editor/standalone/browser/simpleServices';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { ITextDiffEditor, IResourceDiffInput, EditorModel, ITextEditorModel } from 'vs/workbench/common/editor';
import { TextDiffEditor } from 'vs/workbench/browser/parts/editor/textDiffEditor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import {DiffEditorModel} from 'vs/workbench/common/editor/diffEditorModel';
import { TextDiffEditorModel} from 'vs/workbench/common/editor/textDiffEditorModel';
import {IEditorModel} from 'vs/platform/editor/common/editor';

import { Uri } from 'vscode';
import { BaseTextEditorModel } from 'vs/workbench/common/editor/textEditorModel';
import { CancellationTokenSource } from 'vs/base/common/cancellation';

@Component({
	template: '',
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
	private _instancetiationService: IInstantiationService;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService
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
		this._instantiationService = this._instantiationService.createChild(new ServiceCollection([IProgressService, new SimpleProgressService()]));
		this._editor = this._instantiationService.createInstance(TextDiffEditor);
		this._editor.create(this._el.nativeElement);
		this._editor.setVisible(true);
		let uri1 = this.createUri('1');
		let uri2 = this.createUri('2');
		let cancell = new CancellationTokenSource();

		let editorinput1 =	this._instantiationService.createInstance(UntitledEditorInput, uri1, false, 'plaintext', '', '');
		let editorinput2 =	this._instantiationService.createInstance(UntitledEditorInput, uri2, false, 'plaintext', '', '');
		this._editorInput = this._instantiationService.createInstance(DiffEditorInput, 'MyEditor', 'My description', editorinput1, editorinput2, true);
		this._editor.setInput(this._editorInput, undefined, cancell.token);


		this._editorInput.resolve().then(model => {
			this._editorModel = model as TextDiffEditorModel;
			this.updateModel();
			this.layout();
			this.validate();
		});

		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel);
		this._register(this._editorModel.textDiffEditorModel.original.onDidChangeContent(e => {
			this.contentLeft = this._editorModel.textDiffEditorModel.original.getValue();
			if (this._isAutoResizable) {
				if (this._minimumHeight) {
					//this._editor.setMinimumHeight(this._minimumHeight);
				}
				//this._editor.setHeightToScrollHeight();
			}

			// Notify via an event so that extensions can detect and propagate changes
			this.fireEvent({
				eventType: ComponentEventType.onDidChange,
				args: e
			});
		}));

		this._register(this._editorModel.textDiffEditorModel.modified.onDidChangeContent(e => {
			this.contentRight = this._editorModel.textDiffEditorModel.modified.getValue();
			if (this._isAutoResizable) {
				if (this._minimumHeight) {
					//this._editor.setMinimumHeight(this._minimumHeight);
				}
				//this._editor.setHeightToScrollHeight();
			}

			// Notify via an event so that extensions can detect and propagate changes
			this.fireEvent({
				eventType: ComponentEventType.onDidChange,
				args: e
			});
		}));
	}

	private createUri(input:string): URI {
		let uri = URI.from({ scheme: Schemas.untitled, path: `${this.descriptor.type}-${this.descriptor.id}-${input}` });
		return uri;
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		let width: number = this.convertSizeToNumber(this.width);
		let height: number = this.convertSizeToNumber(this.height);
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
			//this.updateLanguageMode();
		}
		// TODO : what is editor URI used for?
		//this.editorUri = this._uri;
		this._isAutoResizable = this.isAutoResizable;
		this._minimumHeight = this.minimumHeight;
		this.layout();
		this.validate();
	}

	// CSS-bound properties
	public get contentLeft(): string {
		return this.getPropertyOrDefault<sqlops.EditorProperties, string>((props) => props.contentLeft, undefined);
	}

	public set contentLeft(newValue: string) {
		this.setPropertyFromUI<sqlops.EditorProperties, string>((properties, contentLeft) => { properties.contentLeft = contentLeft; }, newValue);
	}

	public get contentRight(): string {
		return this.getPropertyOrDefault<sqlops.EditorProperties, string>((props) => props.contentRight, undefined);
	}

	public set contentRight(newValue: string) {
		this.setPropertyFromUI<sqlops.EditorProperties, string>((properties, contentRight) => { properties.contentRight = contentRight; }, newValue);
	}

	public get languageMode(): string {
		return this.getPropertyOrDefault<sqlops.EditorProperties, string>((props) => props.languageMode, undefined);
	}

	public set languageMode(newValue: string) {
		this.setPropertyFromUI<sqlops.EditorProperties, string>((properties, languageMode) => { properties.languageMode = languageMode; }, newValue);
	}

	public get isAutoResizable(): boolean {
		return this.getPropertyOrDefault<sqlops.EditorProperties, boolean>((props) => props.isAutoResizable, false);
	}

	public set isAutoResizable(newValue: boolean) {
		this.setPropertyFromUI<sqlops.EditorProperties, boolean>((properties, isAutoResizable) => { properties.isAutoResizable = isAutoResizable; }, newValue);
	}

	public get minimumHeight(): number {
		return this.getPropertyOrDefault<sqlops.EditorProperties, number>((props) => props.minimumHeight, this._editor.minimumHeight);
	}

	public set minimumHeight(newValue: number) {
		this.setPropertyFromUI<sqlops.EditorProperties, number>((properties, minimumHeight) => { properties.minimumHeight = minimumHeight; }, newValue);
	}

	public get editorUri(): string {
		return this.getPropertyOrDefault<sqlops.EditorProperties, string>((props) => props.editorUri, '');
	}

	public set editorUri(newValue: string) {
		this.setPropertyFromUI<sqlops.EditorProperties, string>((properties, editorUri) => { properties.editorUri = editorUri; }, newValue);
	}
}