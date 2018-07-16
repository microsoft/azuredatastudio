/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IPartService, Parts } from 'vs/workbench/services/part/common/partService';

import { DialogPane } from 'sql/platform/dialog/dialogPane';

import * as sqlops from 'sqlops';
export class ModelViewInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.ModelViewEditorInput';
	private _container: HTMLElement;
	private _dialogPaneContainer: HTMLElement;
	private _dialogPane: DialogPane;

	constructor(private _title: string, private _modelViewId: string,
		private _options: sqlops.ModelViewEditorOptions,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IPartService private readonly _partService: IPartService
	) {
		super();
		this._container = document.createElement('div');
		this._container.id = `modelView-${_modelViewId}`;
		this._partService.getContainer(Parts.EDITOR_PART).appendChild(this._container);

	}

	public get title(): string {
		return this._title;
	}

	public get modelViewId(): string {
		return this._modelViewId;
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

	public dispose(): void {
		if (this._dialogPane) {
			this._dialogPane.dispose();
		}
		if (this._container) {
			this._container.remove();
			this._container = undefined;
		}
		super.dispose();
	}
}
