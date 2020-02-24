/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput, EditorModel, IEditorInput } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { DialogPane } from 'sql/workbench/services/dialog/browser/dialogPane';
import { Emitter, Event } from 'vs/base/common/event';
import { IWorkbenchLayoutService, Parts } from 'vs/workbench/services/layout/browser/layoutService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { URI } from 'vs/base/common/uri';

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

	save(): Promise<boolean> {
		if (this.saveHandler) {
			return Promise.resolve(this.saveHandler(this.handle));
		}
		return Promise.resolve(true);
	}
}
export class ModelViewInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.ModelViewEditorInput';
	public static Scheme: string = 'ModelViewEditorScheme';
	private _container: HTMLElement;
	private _dialogPaneContainer: HTMLElement;
	private _dialogPane: DialogPane;

	constructor(private _title: string, private _model: ModelViewInputModel,
		private _options: azdata.ModelViewEditorOptions,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IThemeService private readonly themeService: IThemeService
	) {
		super();
		this._model.onDidChangeDirty(() => this._onDidChangeDirty.fire());
		this._container = document.createElement('div');
		this._container.id = `modelView-${_model.modelViewId}`;
		this.layoutService.getContainer(Parts.EDITOR_PART).appendChild(this._container);
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

	public resolve(refresh?: boolean): Promise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return this._title;
	}

	public get resource(): URI | undefined {
		if (this._options.resourceName) {
			return URI.from({ scheme: ModelViewInput.Scheme, path: this._options.resourceName });
		}
		return undefined;
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
		this._dialogPane = new DialogPane(this.title, this.modelViewId, () => undefined, this._instantiationService, this.themeService, false);
		this._dialogPane.createBody(this._dialogPaneContainer);
	}

	public get dialogPane(): DialogPane {
		return this._dialogPane;
	}

	public get options(): azdata.ModelViewEditorOptions {
		return this._options;
	}

	/**
	 * An editor that is dirty will be asked to be saved once it closes.
	 */
	isDirty(): boolean {
		return this._model.isDirty;
	}

	/**
	 * Saves the editor if it is dirty. Subclasses return a promise with a boolean indicating the success of the operation.
	 */
	save(): Promise<IEditorInput | undefined> {
		return this._model.save().then(saved => saved ? this : undefined);
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
