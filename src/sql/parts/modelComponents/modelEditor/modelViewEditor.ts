/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./modelViewEditor';

import { Builder, $ } from 'vs/base/browser/builder';
import { TPromise } from 'vs/base/common/winjs.base';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { Position } from 'vs/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { ModelViewInput } from 'sql/parts/modelComponents/modelEditor/modelViewInput';

export class ModelViewEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.modelViewEditor';

	private _editorFrame: HTMLElement;
	private _content: HTMLElement;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService
	) {
		super(ModelViewEditor.ID, telemetryService, themeService);
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
	public focus(): void {
	}

	public clearInput() {
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

	async setInput(input: ModelViewInput, options?: EditorOptions): TPromise<void, any> {
		if (this.input && this.input.matches(input)) {
			return TPromise.as(undefined);
		}

		this.hideOrRemoveModelViewContainer();

		input.appendModelViewContainer();
		input.container.style.visibility = 'visible';
		this._content.setAttribute('aria-flowto', input.container.id);

		await super.setInput(input, options);
		this.doUpdateContainer();
	}

	private doUpdateContainer() {
		const modelViewContainer = this.input && (this.input as ModelViewInput).container;
		if (modelViewContainer) {
			const frameRect = this._editorFrame.getBoundingClientRect();
			const containerRect = modelViewContainer.parentElement.getBoundingClientRect();

			modelViewContainer.style.position = 'absolute';
			modelViewContainer.style.top = `${frameRect.top}px`;
			modelViewContainer.style.left = `${frameRect.left - containerRect.left}px`;
			modelViewContainer.style.width = `${frameRect.width}px`;
			modelViewContainer.style.height = `${frameRect.height}px`;
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
