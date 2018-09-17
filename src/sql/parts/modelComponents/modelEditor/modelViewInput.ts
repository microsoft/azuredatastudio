/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, ConfirmResult } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IPartService, Parts } from 'vs/workbench/services/part/common/partService';

import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { Emitter, Event } from 'vs/base/common/event';

export type ModeViewSaveHandler = (handle: number) => Thenable<boolean>;

export class ModelViewInputModel extends EditorModel {
	private dirty: boolean;
	private readonly _onDidChangeDirty: Emitter<void> = this._register(new Emitter<void>());
	get onDidChangeDirty(): Event<void> { return this._onDidChangeDirty.event; }

	constructor(public readonly modelViewId, private readonly handle: number, private saveHandler?: ModeViewSaveHandler) {
		super();
		this.dirty = false;
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
export class ModelViewInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.ModelViewEditorInput';
	private _container: HTMLElement;
	private _dialogPaneContainer: HTMLElement;
	private _dialogPane: DialogPane;

	constructor(private _title: string, private _model: ModelViewInputModel,
		private _options: sqlops.ModelViewEditorOptions,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IPartService private readonly _partService: IPartService
	) {
		super();
		this._model.onDidChangeDirty(() => this._onDidChangeDirty.fire());
		this._container = document.createElement('div');
		this._container.id = `modelView-${_model.modelViewId}`;
		this._partService.getContainer(Parts.EDITOR_PART).appendChild(this._container);

	}

	public get title(): string {
		return this._title;
	}

	public get modelViewId(): string {
		return this._model.modelViewId;
	}

	public getTypeId(): string {
		return 'ModelViewEditorInput';
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return this._title;
	}

	public get container(): HTMLElement {
		return this._container;
	}

	public appendModelViewContainer(): void {
		if (!this._dialogPane) {
			this.createDialogPane();
		}
		if (!this._container.contains(this._dialogPaneContainer)) {
			this._container.appendChild(this._dialogPaneContainer);
		}
	}

	public removeModelViewContainer(): void {
		if (this._dialogPaneContainer) {
			this._container.removeChild(this._dialogPaneContainer);
		}
	}

	private createDialogPane(): void {
		this._dialogPaneContainer = DOM.$('div.model-view-container');
		this._dialogPane = new DialogPane(this.title, this.modelViewId, () => undefined, this._instantiationService, false);
		this._dialogPane.createBody(this._dialogPaneContainer);
	}

	public get dialogPane(): DialogPane {
		return this._dialogPane;
	}

	public get options(): sqlops.ModelViewEditorOptions {
		return this._options;
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
		return TPromise.wrap(ConfirmResult.DONT_SAVE);
	}

	/**
	 * Saves the editor if it is dirty. Subclasses return a promise with a boolean indicating the success of the operation.
	 */
	save(): TPromise<boolean> {
		return this._model.save();
	}

	public dispose(): void {
		if (this._dialogPane) {
			this._dialogPane.dispose();
		}
		if (this._container) {
			this._container.remove();
			this._container = undefined;
		}
		if (this._model) {
			this._model.dispose();
		}
		super.dispose();
	}
}
