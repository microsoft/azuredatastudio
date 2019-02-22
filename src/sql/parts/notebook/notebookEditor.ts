/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TPromise } from 'vs/base/common/winjs.base';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { CancellationToken } from 'vs/base/common/cancellation';
import { NotebookInput } from 'sql/parts/notebook/notebookInput';
import { NotebookModule } from 'sql/parts/notebook/notebook.module';
import { NOTEBOOK_SELECTOR } from 'sql/parts/notebook/notebook.component';
import { INotebookParams, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/common/notebookService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { $ } from 'sql/base/browser/builder';

export class NotebookEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.notebookEditor';
	private _notebookContainer: HTMLElement;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService
	) {
		super(NotebookEditor.ID, telemetryService, themeService, storageService);
	}

	public get notebookInput(): NotebookInput {
		return this.input as NotebookInput;
	}

	/**
	 * Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public focus(): void {
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		if (this.notebookInput) {
			this.notebookInput.doChangeLayout();
		}
	}

	public setInput(input: NotebookInput, options: EditorOptions): TPromise<void> {
		if (this.input && this.input.matches(input)) {
			return TPromise.as(undefined);
		}

		const parentElement = this.getContainer();

		super.setInput(input, options, CancellationToken.None);

		$(parentElement).clearChildren();

		if (!input.hasBootstrapped) {
			let container = DOM.$<HTMLElement>('.notebookEditor');
			container.style.height = '100%';
			this._notebookContainer = DOM.append(parentElement, container);
			input.container = this._notebookContainer;
			return TPromise.wrap<void>(this.bootstrapAngular(input));
		} else {
			this._notebookContainer = DOM.append(parentElement, input.container);
			input.doChangeLayout();
			return TPromise.wrap<void>(null);
		}
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(input: NotebookInput): void {
		// Get the bootstrap params and perform the bootstrap
		input.hasBootstrapped = true;
		let params: INotebookParams = {
			notebookUri: input.notebookUri,
			input: input,
			providerId: input.providerId ? input.providerId : DEFAULT_NOTEBOOK_PROVIDER,
			providers: input.providers ? input.providers : [DEFAULT_NOTEBOOK_PROVIDER],
			isTrusted: input.isTrusted,
			connectionProfileId: input.connectionProfileId
		};
		bootstrapAngular(this.instantiationService,
			NotebookModule,
			this._notebookContainer,
			NOTEBOOK_SELECTOR,
			params,
			input
		);
	}
}

