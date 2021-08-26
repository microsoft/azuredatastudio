/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';

export interface IGridPanel {
	readonly onRefreshComplete: Promise<void>;
}

/**
 * Input for the EditDataResultsEditor. This input helps with logic for the viewing and editing of
 * data in the results grid.
 */
export class EditDataResultsInput extends EditorInput {

	// Tracks if the editor that holds this input should be visible (i.e. true if a query has been run)
	private _visible: boolean;

	// Tracks if the editor has holds this input has has bootstrapped angular yet
	private _hasBootstrapped: boolean;

	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _editorContainer?: HTMLElement;
	public css?: HTMLStyleElement;

	public readonly onRestoreViewStateEmitter = new Emitter<void>();
	public readonly onSaveViewStateEmitter = new Emitter<void>();
	private _editDataGridPanel?: IGridPanel;

	constructor(private _uri: string) {
		super();
		this._visible = false;
		this._hasBootstrapped = false;
	}

	get editDataGridPanel(): IGridPanel | undefined {
		return this._editDataGridPanel;
	}

	set editDataGridPanel(gridPanel: IGridPanel | undefined) {
		this._editDataGridPanel = gridPanel;
	}

	override get typeId(): string {
		return EditDataResultsInput.ID;
	}

	override matches(other: any): boolean {
		if (other instanceof EditDataResultsInput) {
			return (other._uri === this._uri);
		}

		return false;
	}

	override resolve(refresh?: boolean): Promise<any> {
		return Promise.resolve(null);
	}

	supportsSplitEditor(): boolean {
		return false;
	}

	public setBootstrappedTrue(): void {
		this._hasBootstrapped = true;
	}

	public override dispose(): void {
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._editorContainer) {
			return;
		}

		let parentContainer = this._editorContainer.parentNode;
		if (parentContainer) {
			parentContainer.removeChild(this._editorContainer);
			this._editorContainer = undefined;
		}
	}

	//// Properties

	static get ID() {
		return 'workbench.editorinputs.editDataResultsInput';
	}

	setContainer(container: HTMLElement) {
		this._disposeContainer();
		this._editorContainer = container;
	}

	get container(): HTMLElement | undefined {
		return this._editorContainer;
	}

	get hasBootstrapped(): boolean {
		return this._hasBootstrapped;
	}

	get visible(): boolean {
		return this._visible;
	}

	set visible(visible: boolean) {
		this._visible = visible;
	}

	get uri(): string {
		return unescape(this._uri);
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
