/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { EditorInput } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';

import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { DialogPane } from 'sql/platform/dialog/dialogPane';

import * as sqlops from 'sqlops';
export class ModelViewInput extends EditorInput {

	public static ID: string = 'workbench.editorinputs.ModelViewEditorInput';
	private _container: HTMLElement;
	private _dialogPane: DialogPane;

	constructor(private _title: string, private _modelViewId: string,
		private _options: sqlops.ModelViewEditorOptions,
		@IBootstrapService private _bootstrapService: IBootstrapService,
	) {
		super();
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
		if (!this._container && !this._dialogPane) {
			this._container = DOM.$('div.model-view-container');
			this._dialogPane = new DialogPane(this.title, this.modelViewId, () => undefined, this._bootstrapService);
			this._dialogPane.createBody(this._container);
		}
		return this._container;
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
		super.dispose();
	}
}
