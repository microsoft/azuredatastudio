/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/modelViewEditor';

import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';

import { ModelViewInput } from 'sql/workbench/browser/modelComponents/modelViewInput';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IEditorOptions } from 'vs/platform/editor/common/editor';

export class ModelViewEditor extends EditorPane {

	public static ID: string = 'workbench.editor.modelViewEditor';

	private _editorFrame: HTMLElement;
	private _content: HTMLElement;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService
	) {
		super(ModelViewEditor.ID, telemetryService, themeService, storageService);
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		this._editorFrame = parent;
		this._content = document.createElement('div');
		parent.appendChild(this._content);
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public override focus(): void {
	}

	public override clearInput() {
		this.hideOrRemoveModelViewContainer();
		super.clearInput();
	}

	private hideOrRemoveModelViewContainer() {
		if (this.input instanceof ModelViewInput) {
			if (this.input.container) {
				if (this.input.options && this.input.options.retainContextWhenHidden) {
					this.input.container.style.visibility = 'hidden';
				} else {
					this.input.removeModelViewContainer();
					this.input.container.style.visibility = 'hidden';
				}
			}
		}
	}

	override async setInput(input: ModelViewInput, options?: IEditorOptions, context?: IEditorOpenContext): Promise<void> {
		if (this.input && this.input.matches(input)) {
			return Promise.resolve(undefined);
		}

		this.hideOrRemoveModelViewContainer();

		input.appendModelViewContainer();
		input.container.style.visibility = 'visible';
		this._content.setAttribute('aria-flowto', input.container.id);

		await super.setInput(input, options, context, CancellationToken.None);
		this.doUpdateContainer();
	}

	private doUpdateContainer() {
		let modelViewInput = this.input as ModelViewInput;
		const modelViewContainer = modelViewInput && modelViewInput.container;
		if (modelViewContainer) {
			const frameRect = this._editorFrame.getBoundingClientRect();
			const containerRect = modelViewContainer.parentElement.getBoundingClientRect();

			modelViewContainer.style.position = 'absolute';
			modelViewContainer.style.top = `${frameRect.top - containerRect.top}px`;
			modelViewContainer.style.left = `${frameRect.left - containerRect.left}px`;
			modelViewContainer.style.width = `${frameRect.width}px`;
			modelViewContainer.style.height = `${frameRect.height}px`;
			if (modelViewInput.dialogPane) {
				modelViewInput.dialogPane.layout(true);
			}
		}
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		if (this.input instanceof ModelViewInput) {
			if (this.input.container && this.input.dialogPane) {
				this.doUpdateContainer();
				// todo: layout this.input.dialogPane (Github issue: #1484)
			}
		}
	}

}
