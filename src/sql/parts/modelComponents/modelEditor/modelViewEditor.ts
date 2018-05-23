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
import { Dimension } from 'vs/workbench/services/part/common/partService';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';

import { ModelViewInput } from 'sql/parts/modelComponents/modelEditor/modelViewInput';

export class ModelViewEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.modelViewEditor';

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService
	) {
		super(ModelViewEditor.ID, telemetryService, themeService);
	}

	/**
	 * Called to create the editor in the parent builder.
	 */
	public createEditor(parent: Builder): void {
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public focus(): void {
	}

	public setInput(input: ModelViewInput, options?: EditorOptions): TPromise<void, any> {
		if (this.input && this.input.matches(input)) {
			return TPromise.as(undefined);
		}
		const parentElement = this.getContainer().getHTMLElement();
		$(parentElement).clearChildren();

		DOM.append(parentElement, input.container);

		return super.setInput(input, options);
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: Dimension): void {

	}

}
