/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryEditor';

import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension } from 'vs/base/browser/dom';
import { EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { TaskDialogInput } from './taskDialogInput';
import { ITaskDialogComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { TaskDialogModule } from 'sql/parts/tasks/dialog/taskDialog.module';
import { TASKDIALOG_SELECTOR } from 'sql/parts/tasks/dialog/taskDialog.component';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';

export class TaskDialogEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.taskdialog';

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService
	) {
		super(TaskDialogEditor.ID, telemetryService, themeService, storageService);
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
	public layout(dimension: Dimension): void {
	}

	public setInput(input: TaskDialogInput, options: EditorOptions): Thenable<void> {
		if (this.input instanceof TaskDialogInput && this.input.matches(input)) {
			return TPromise.as(undefined);
		}

		if (!input.hasInitialized) {
			this.bootstrapAngular(input);
		}
		this.revealElementWithTagName(input.uniqueSelector, this.getContainer());

		return super.setInput(input, options, CancellationToken.None);
	}

	/**
	 * Reveal the child element with the given tagName and hide all other elements.
	 */
	private revealElementWithTagName(tagName: string, parent: HTMLElement): void {
		let elementToReveal: HTMLElement;

		for (let i = 0; i < parent.children.length; i++) {
			let child: HTMLElement = <HTMLElement>parent.children[i];
			if (child.tagName && child.tagName.toLowerCase() === tagName && !elementToReveal) {
				elementToReveal = child;
			} else {
				child.style.display = 'none';
			}
		}

		if (elementToReveal) {
			elementToReveal.style.display = '';
		}
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(input: TaskDialogInput): void {

		// Get the bootstrap params and perform the bootstrap
		let params: ITaskDialogComponentParams = {
			ownerUri: input.getUri()
		};
		let uniqueSelector = bootstrapAngular(this.instantiationService,
			TaskDialogModule,
			this.getContainer(),
			TASKDIALOG_SELECTOR,
			params);
		input.setUniqueSelector(uniqueSelector);
	}

	public dispose(): void {
		super.dispose();
	}
}
