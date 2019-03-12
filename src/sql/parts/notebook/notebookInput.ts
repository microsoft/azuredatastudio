/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as azdata from 'azdata';

import { IStandardKernelWithProvider, getProvidersForFileName, getStandardKernelsForProvider } from 'sql/parts/notebook/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/common/notebookService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { INotebookModel, IContentManager } from 'sql/parts/notebook/models/modelInterfaces';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { Range } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { Schemas } from 'vs/base/common/network';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { notebookModeId } from 'sql/common/constants';
import { ITextFileService, ISaveOptions } from 'vs/workbench/services/textfile/common/textfiles';
import { LocalContentManager } from 'sql/workbench/services/notebook/node/localContentManager';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;


export class NotebookEditorModel extends EditorModel {
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	constructor(public readonly notebookUri: URI,
		private textEditorModel: TextFileEditorModel | UntitledEditorModel,
		@INotebookService private notebookService: INotebookService,
		@ITextFileService private textFileService: ITextFileService
	) {
		super();
		this._register(this.notebookService.onNotebookEditorAdd(notebook => {
			if (notebook.id === this.notebookUri.toString()) {
				// Hook to content change events
				notebook.modelReady.then(() => {
					this._register(notebook.model.contentChanged(e => this.updateModel()));
				}, err => undefined);
			}
		}));

		if (this.textEditorModel instanceof UntitledEditorModel) {
			this._register(this.textEditorModel.onDidChangeDirty(e => this.setDirty(this.textEditorModel.isDirty())));
		} else {
			this._register(this.textEditorModel.onDidStateChange(e => this.setDirty(this.textEditorModel.isDirty())));
		}
		this.dirty = this.textEditorModel.isDirty();
	}

	public get contentString(): string {
		let model = this.textEditorModel.textEditorModel;
		return model.getValue();
	}

	get isDirty(): boolean {
		return this.textEditorModel.isDirty();
	}

	public setDirty(dirty: boolean): void {
		if (this.dirty === dirty) {
			return;
		}
		this.dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	public confirmSave(): TPromise<ConfirmResult> {
		return this.textFileService.confirmSave([this.notebookUri]);
	}

	/**
	 * UntitledEditor uses TextFileService to save data from UntitledEditorInput
	 * Titled editor uses TextFileEditorModel to save existing notebook
	*/
	save(options: ISaveOptions): TPromise<boolean> {
		if (this.textEditorModel instanceof TextFileEditorModel) {
			this.textEditorModel.save(options);
			return TPromise.as(true);
		}
		else {
			return this.textFileService.save(this.notebookUri, options);
		}
	}

	public updateModel(): void {
		let notebookModel = this.getNotebookModel();
		if (notebookModel && this.textEditorModel && this.textEditorModel.textEditorModel) {
			let content = JSON.stringify(notebookModel.toJSON(), undefined, '    ');
			let model = this.textEditorModel.textEditorModel;
			let endLine = model.getLineCount();
			let endCol = model.getLineLength(endLine);
			this.textEditorModel.textEditorModel.applyEdits([{
				range: new Range(1, 1, endLine, endCol),
				text: content
			}]);
		}
	}

	isModelCreated(): boolean {
		return this.getNotebookModel() !== undefined;
	}

	private getNotebookModel(): INotebookModel {
		let editor = this.notebookService.listNotebookEditors().find(n => n.id === this.notebookUri.toString());
		if (editor) {
			return editor.model;
		}
		return undefined;
	}

	get onDidChangeDirty(): Event<void> {
		return this._onDidChangeDirty.event;
	}
}

export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';
	private _providerId: string;
	private _providers: string[];
	private _standardKernels: IStandardKernelWithProvider[];
	private _connectionProfile: IConnectionProfile;
	private _defaultKernel: azdata.nb.IKernelSpec;
	private _isTrusted: boolean = false;
	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;
	private readonly _layoutChanged: Emitter<void> = this._register(new Emitter<void>());
	private _model: NotebookEditorModel;
	private _untitledEditorService: IUntitledEditorService;
	private _contentManager: IContentManager;

	constructor(private _title: string,
		private resource: URI,
		@ITextModelService private textModelService: ITextModelService,
		@IUntitledEditorService untitledEditorService: IUntitledEditorService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		this._untitledEditorService = untitledEditorService;
		this.resource = resource;
		this._standardKernels = [];
		this.assignProviders();
	}

	public confirmSave(): TPromise<ConfirmResult> {
		return this._model.confirmSave();
	}

	public get notebookUri(): URI {
		return this.resource;
	}

	public get contentManager(): IContentManager {
		if (!this._contentManager) {
			this._contentManager = new NotebookEditorContentManager(this);
		}
		return this._contentManager;
	}

	public getName(): string {
		if (!this._title) {
			this._title = resources.basenameOrAuthority(this.resource);
		}
		return this._title;
	}

	public get providerId(): string {
		return this._providerId;
	}

	public set providerId(value: string) {
		this._providerId = value;
	}

	public get isTrusted(): boolean {
		return this._isTrusted;
	}

	public set isTrusted(value: boolean) {
		this._isTrusted = value;
	}

	public set connectionProfile(value: IConnectionProfile) {
		this._connectionProfile = value;
	}

	public get connectionProfile(): IConnectionProfile {
		return this._connectionProfile;
	}

	public get standardKernels(): IStandardKernelWithProvider[] {
		return this._standardKernels;
	}

	public get providers(): string[] {
		return this._providers;
	}

	public set providers(value: string[]) {
		this._providers = value;
	}

	public save(): TPromise<boolean> {
		let options: ISaveOptions = { force: false };
		return this._model.save(options);
	}

	public set standardKernels(value: IStandardKernelWithProvider[]) {
		value.forEach(kernel => {
			this._standardKernels.push({
				connectionProviderIds: kernel.connectionProviderIds,
				name: kernel.name,
				displayName: kernel.displayName,
				notebookProvider: kernel.notebookProvider
			});
		});
	}

	public get defaultKernel(): azdata.nb.IKernelSpec {
		return this._defaultKernel;
	}

	public set defaultKernel(kernel: azdata.nb.IKernelSpec) {
		this._defaultKernel = kernel;
	}

	get layoutChanged(): Event<void> {
		return this._layoutChanged.event;
	}

	doChangeLayout(): any {
		this._layoutChanged.fire();
	}

	public getTypeId(): string {
		return NotebookInput.ID;
	}

	getResource(): URI {
		return this.resource;
	}

	async resolve(): TPromise<NotebookEditorModel> {
		if (this._model && this._model.isModelCreated()) {
			return TPromise.as(this._model);
		} else {
			let textOrUntitledEditorModel: UntitledEditorModel | IEditorModel;
			if (this.resource.scheme === Schemas.untitled) {
				textOrUntitledEditorModel = await this._untitledEditorService.loadOrCreate({ resource: this.resource, modeId: notebookModeId });
			}
			else {
				const textEditorModelReference = await this.textModelService.createModelReference(this.resource);
				textOrUntitledEditorModel = await textEditorModelReference.object.load();
			}
			this._model = this.instantiationService.createInstance(NotebookEditorModel, this.resource, textOrUntitledEditorModel);
			this._model.onDidChangeDirty(() => this._onDidChangeDirty.fire());
			return this._model;
		}
	}

	private assignProviders(): void {
		let providerIds: string[] = getProvidersForFileName(this._title, this.notebookService);
		if (providerIds && providerIds.length > 0) {
			this._providerId = providerIds.filter(provider => provider !== DEFAULT_NOTEBOOK_PROVIDER)[0];
			this._providers = providerIds;
			this._standardKernels = [];
			this._providers.forEach(provider => {
				let standardKernels = getStandardKernelsForProvider(provider, this.notebookService);
				this._standardKernels.push(...standardKernels);
			});
		}
	}

	public dispose(): void {
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._parentContainer) {
			return;
		}

		let parentNode = this._parentContainer.parentNode;
		if (parentNode) {
			parentNode.removeChild(this._parentContainer);
			this._parentContainer = null;
		}
	}

	set container(container: HTMLElement) {
		this._disposeContainer();
		this._parentContainer = container;
	}

	get container(): HTMLElement {
		return this._parentContainer;
	}

	/**
	 * An editor that is dirty will be asked to be saved once it closes.
	 */
	isDirty(): boolean {
		if (this._model) {
			return this._model.isDirty;
		}
		return false;
	}

	/**
	 * Sets active editor with dirty value.
	 * @param isDirty boolean value to set editor dirty
	 */
	setDirty(isDirty: boolean): void {
		if (this._model) {
			this._model.setDirty(isDirty);
		}
	}

	updateModel(): void {
		this._model.updateModel();
	}

	public matches(otherInput: any): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput instanceof NotebookInput) {
			const otherNotebookEditorInput = <NotebookInput>otherInput;

			// Compare by resource
			return otherNotebookEditorInput.notebookUri.toString() === this.notebookUri.toString();
		}
		return false;
	}
}

class NotebookEditorContentManager implements IContentManager {
	constructor(private notebookInput: NotebookInput) {
	}

	async loadContent(): Promise<azdata.nb.INotebookContents> {
		let notebookEditorModel = await this.notebookInput.resolve();
		let contentManager = new LocalContentManager();
		let contents = await contentManager.loadFromContentString(notebookEditorModel.contentString);
		return contents;
	}

}
