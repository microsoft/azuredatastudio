/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Builder, $ } from 'vs/base/browser/builder';
import { TPromise } from 'vs/base/common/winjs.base';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Dimension } from 'vs/workbench/services/part/common/partService';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { ModelViewInput } from 'sql/parts/modelComponents/modelEditor/modelViewInput';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { Dialog } from 'sql/platform/dialog/dialogTypes';
import { DialogPane } from 'sql/platform/dialog/dialogPane';

export class ModelViewEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.modelViewEditor';
	private _modelViewMap = new Map<string, HTMLElement>();

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService
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

		if (!this._modelViewMap.get(input.modelViewId)) {
			let modelViewContainer = DOM.$('div.model-view-container');
			let dialogPane = new DialogPane(input.title, input.modelViewId, () => undefined, this._instantiationService);
			dialogPane.createBody(modelViewContainer);
			this._modelViewMap.set(input.modelViewId, modelViewContainer);
		}
		let element = this._modelViewMap.get(input.modelViewId);
		DOM.append(parentElement, element);

		return super.setInput(input, options);
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: Dimension): void {

	}

}
