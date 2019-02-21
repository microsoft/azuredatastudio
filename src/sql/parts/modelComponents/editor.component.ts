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

@Component({
	template: '',
	selector: 'modelview-editor-component'
})
export default class EditorComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _editor: QueryTextEditor;
	private _editorInput: UntitledEditorInput;
	private _editorModel: ITextModel;
	private _renderedContent: string;
	private _languageMode: string;
	private _uri: string;
	private _isAutoResizable: boolean;
	private _minimumHeight: number;

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
		let instantiationService = this._instantiationService.createChild(new ServiceCollection([IProgressService, new SimpleProgressService()]));
		this._editor = instantiationService.createInstance(QueryTextEditor);
		this._editor.create(this._el.nativeElement);
		this._editor.setVisible(true);
		let uri = this.createUri();
		this._editorInput = instantiationService.createInstance(UntitledEditorInput, uri, false, 'plaintext', '', '');
		this._editor.setInput(this._editorInput, undefined);
		this._editorInput.resolve().then(model => {
			this._editorModel = model.textEditorModel;
			this.fireEvent({
				eventType: ComponentEventType.onComponentCreated,
				args: this._uri
			});
		});

		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel.onDidChangeContent(e => {
			this.content = this._editorModel.getValue();
			if (this._isAutoResizable) {
				if (this._minimumHeight) {
					this._editor.setMinimumHeight(this._minimumHeight);
				}
				this._editor.setHeightToScrollHeight();
			}

			// Notify via an event so that extensions can detect and propagate changes
			this.fireEvent({
				eventType: ComponentEventType.onDidChange,
				args: e
			});
		}));
	}

	private createUri(): URI {
		let uri = URI.from({ scheme: Schemas.untitled, path: `${this.descriptor.type}-${this.descriptor.id}` });
		// Use this to set the internal (immutable) and public (shared with extension) uri properties
		this._uri = uri.toString();
		this.editorUri = this._uri;
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
			this._editor.setHeightToScrollHeight();
			height = Math.max(this._editor.scrollHeight, this._minimumHeight ? this._minimumHeight : 0);
		}
		this._editor.layout(new DOM.Dimension(
			width && width > 0 ? width : DOM.getContentWidth(this._el.nativeElement),
			height && height > 0 ? height : DOM.getContentHeight(this._el.nativeElement)));
		let element = <HTMLElement>this._el.nativeElement;
		element.style.position = this.position;
	}

	/// Editor Functions
	private updateModel() {
		if (this._editorModel) {
			this._renderedContent = this.content;
			this._modelService.updateModel(this._editorModel, this._renderedContent);
		}
	}

	private updateLanguageMode() {
		if (this._editorModel && this._editor) {
			this._languageMode = this.languageMode;
			let languageSelection = this._modeService.create(this._languageMode);
			this._modelService.setMode(this._editorModel, languageSelection);
		}
	}

	/// IComponent implementation
	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.content !== this._renderedContent) {
			this.updateModel();
		}
		if (this.languageMode !== this._languageMode) {
			this.updateLanguageMode();
		}
		// Intentionally always updating editorUri as it's wiped out by parent setProperties call.
		this.editorUri = this._uri;
		this._isAutoResizable = this.isAutoResizable;
		this._minimumHeight = this.minimumHeight;
	}

	// CSS-bound properties
	public get content(): string {
		return this.getPropertyOrDefault<sqlops.EditorProperties, string>((props) => props.content, undefined);
	}

	public set content(newValue: string) {
		this.setPropertyFromUI<sqlops.EditorProperties, string>((properties, content) => { properties.content = content; }, newValue);
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
