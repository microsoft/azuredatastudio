/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult, ITextEditorModel } from 'vs/workbench/common/editor';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import * as azdata from 'azdata';

import { IStandardKernelWithProvider } from 'sql/parts/notebook/notebookUtils';
import { INotebookService, INotebookEditor } from 'sql/workbench/services/notebook/common/notebookService';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import Severity from 'vs/base/common/severity';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ISaveOptions } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;


export class NotebookEditorModel extends EditorModel {
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _providerId: string;
	private _providers: string[];
	private _connectionProfileId: string;
	private _standardKernels: IStandardKernelWithProvider[];
	private _defaultKernel: azdata.nb.IKernelSpec;
	constructor(public readonly notebookUri: URI,
		private _isTrusted: boolean = false,
		private textEditorModel: TextFileEditorModel,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		this._standardKernels = [];
		this._register(this.notebookService.onNotebookEditorAdd(notebook => {
			if (notebook.id === this.notebookUri.toString()) {
				// Hook to content change events
				this._register(notebook.model.contentChanged(e => this.updateModel()));
				this._register(notebook.model.kernelChanged(e => this.updateModel()));
			}
		}));
	}

	public get contentString(): string {
		//TODO: Handle Save As
		// if(!this.textEditorModel || !this.textEditorModel.textEditorModel){
		// 	return '';
		// }
		let model = this.textEditorModel.textEditorModel;
		return model.getValue();
	}

	save(options: ISaveOptions): TPromise<void> {
		options.force = false;
		this.updateModel();
		return this.textEditorModel.save(options);
	}

	isDirty(): boolean {
		//TODO: Need to handle dirty with file save
		// if(!this.textEditorModel){
		// 	return true;
		// }
		return this.textEditorModel.isDirty();
	}

	public setDirty(dirty: boolean): void {
		if (this.dirty === dirty) {
			return;
		}
		this.dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	private updateModel(): void {
		let notebookModel = this.getNotebookModel();
		if (notebookModel && this.textEditorModel && this.textEditorModel.textEditorModel) {
			let content = JSON.stringify(notebookModel.toJSON(), undefined, '    ');
			this.textEditorModel.textEditorModel.setValue(content);
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

	public get providerId(): string {
		return this._providerId;
	}

	public set providerId(value: string) {
		this._providerId = value;
	}

	public get providers(): string[] {
		return this._providers;
	}

	public set providers(value: string[]) {
		this._providers = value;
	}

	public get connectionProfileId(): string {
		return this._connectionProfileId;
	}

	public get standardKernels(): IStandardKernelWithProvider[] {
		return this._standardKernels;
	}

	public set standardKernels(value: IStandardKernelWithProvider[]) {
		value.forEach(kernel => {
			this._standardKernels.push({
				connectionProviderIds: kernel.connectionProviderIds,
				name: kernel.name,
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

	get isTrusted(): boolean {
		return this._isTrusted;
	}

	get onDidChangeDirty(): Event<void> {
		return this._onDidChangeDirty.event;
	}


}

export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;
	private readonly _layoutChanged: Emitter<void> = this._register(new Emitter<void>());

	constructor(private _title: string,
		private resource: URI,
		private _model: NotebookEditorModel,
		@ITextModelService private textModelService: ITextModelService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IDialogService private dialogService: IDialogService
	) {
		super();
		this.resource = resource;
		this._model.onDidChangeDirty(() => this._onDidChangeDirty.fire());
	}

	public get notebookUri(): URI {
		return this._model.notebookUri;
	}

	public getName(): string {
		if (!this._title) {
			this._title = resources.basenameOrAuthority(this._model.notebookUri);
		}
		return this._title;
	}

	public get providerId(): string {
		return this._model.providerId;
	}

	public get providers(): string[] {
		return this._model.providers;
	}

	public get connectionProfileId(): string {
		return this._model.connectionProfileId;
	}

	public get standardKernels(): IStandardKernelWithProvider[] {
		return this._model.standardKernels;
	}

	public get defaultKernel(): azdata.nb.IKernelSpec {
		return this._model.defaultKernel;
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
		if(this._model && this._model.isModelCreated()){
			return TPromise.as(this._model);
		}else{
		const textEditorModelReference = await this.textModelService.createModelReference(this.resource);
		const textEditorModel = await textEditorModelReference.object.load();
		this._model = this.instantiationService.createInstance(NotebookEditorModel, this.resource, false, textEditorModel);
		return this._model;
		}
	}

	public get isTrusted(): boolean {
		return this._model.isTrusted;
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

	// /**
	//  * An editor that is dirty will be asked to be saved once it closes.
	//  */
	// isDirty(): boolean {
		//TODO: Check dirty implementation
	// 	return this._model.isDirty();
	// }

	/**
	 * Subclasses should bring up a proper dialog for the user if the editor is dirty and return the result.
	 */
	confirmSave(): TPromise<ConfirmResult> {
		// TODO #2530 support save on close / confirm save. This is significantly more work
		// as we need to either integrate with textFileService (seems like this isn't viable)
		// or register our own complimentary service that handles the lifecycle operations such
		// as close all, auto save etc.
		const message = nls.localize('saveChangesMessage', "Do you want to save the changes you made to {0}?", this.getTitle());
		const buttons: string[] = [
			nls.localize({ key: 'save', comment: ['&& denotes a mnemonic'] }, "&&Save"),
			nls.localize({ key: 'dontSave', comment: ['&& denotes a mnemonic'] }, "Do&&n't Save"),
			nls.localize('cancel', "Cancel")
		];

		return this.dialogService.show(Severity.Warning, message, buttons, {
			cancelId: 2,
			detail: nls.localize('saveChangesDetail', "Your changes will be lost if you don't save them.")
		}).then(index => {
			switch (index) {
				case 0: return ConfirmResult.SAVE;
				case 1: return ConfirmResult.DONT_SAVE;
				default: return ConfirmResult.CANCEL;
			}
		});
	}

	/**
	 * Sets active editor with dirty value.
	 * @param isDirty boolean value to set editor dirty
	 */
	setDirty(isDirty: boolean): void {
		this._model.setDirty(isDirty);
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
