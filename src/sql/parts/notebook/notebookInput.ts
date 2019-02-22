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
import * as sqlops from 'sqlops';

import { IStandardKernelWithProvider } from 'sql/parts/notebook/notebookUtils';
import { INotebookService, INotebookEditor } from 'sql/workbench/services/notebook/common/notebookService';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import Severity from 'vs/base/common/severity';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;


export class NotebookInputModel extends EditorModel {
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	private _providerId: string;
	private _standardKernels: IStandardKernelWithProvider[];
	private _defaultKernel: sqlops.nb.IKernelSpec;
	constructor(public readonly notebookUri: URI,
		private readonly handle: number,
		private _isTrusted: boolean = false,
		private saveHandler?: ModeViewSaveHandler,
		provider?: string,
		private _providers?: string[],
		private _connectionProfileId?: string) {

		super();
		this.dirty = false;
		this._providerId = provider;
		this._standardKernels = [];
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

	public get defaultKernel(): sqlops.nb.IKernelSpec {
		return this._defaultKernel;
	}

	public set defaultKernel(kernel: sqlops.nb.IKernelSpec) {
		this._defaultKernel = kernel;
	}

	get isTrusted(): boolean {
		return this._isTrusted;
	}

	get onDidChangeDirty(): Event<void> {
		return this._onDidChangeDirty.event;
	}

	get isDirty(): boolean {
		return this.dirty;
	}

	public setDirty(dirty: boolean): void {
		if (this.dirty === dirty) {
			return;
		}

		this.dirty = dirty;
		this._onDidChangeDirty.fire();
	}

	save(): TPromise<boolean> {
		if (this.saveHandler) {
			return TPromise.wrap(this.saveHandler(this.handle));
		}
		return TPromise.wrap(true);
	}
}


export class NotebookInput extends EditorInput {
	public static ID: string = 'workbench.editorinputs.notebookInput';

	public hasBootstrapped = false;
	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _parentContainer: HTMLElement;
	private readonly _layoutChanged: Emitter<void> = this._register(new Emitter<void>());
	constructor(private _title: string,
		private _model: NotebookInputModel,
		@INotebookService private notebookService: INotebookService,
		@IDialogService private dialogService: IDialogService
	) {
		super();
		this._model.onDidChangeDirty(() => this._onDidChangeDirty.fire());
	}

	public get notebookUri(): URI {
		return this._model.notebookUri;
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

	public get defaultKernel(): sqlops.nb.IKernelSpec {
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

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		if (!this._title) {
			this._title = resources.basenameOrAuthority(this._model.notebookUri);
		}

		return this._title;
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

	/**
	 * An editor that is dirty will be asked to be saved once it closes.
	 */
	isDirty(): boolean {
		return this._model.isDirty;
	}

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
	 * Saves the editor if it is dirty. Subclasses return a promise with a boolean indicating the success of the operation.
	 */
	save(): TPromise<boolean> {
		let activeEditor: INotebookEditor;
		for (const editor of this.notebookService.listNotebookEditors()) {
			if (editor.isActive()) {
				activeEditor = editor;
			}
		}
		if (activeEditor) {
			return TPromise.wrap(activeEditor.save().then((val) => { return val; }));
		}
		return TPromise.wrap(false);
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