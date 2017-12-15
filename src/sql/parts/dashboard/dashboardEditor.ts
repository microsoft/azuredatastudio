/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { TPromise } from 'vs/base/common/winjs.base';
import { Dimension, Builder, $ } from 'vs/base/browser/builder';
import { EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { DashboardInput } from './dashboardInput';
import { DashboardModule } from './dashboard.module';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { DashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { DASHBOARD_SELECTOR } from 'sql/parts/dashboard/dashboard.component';

export class DashboardEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.connectiondashboard';
	private _dashboardContainer: HTMLElement;
	protected _input: DashboardInput;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IBootstrapService private _bootstrapService: IBootstrapService
	) {
		super(DashboardEditor.ID, telemetryService, themeService);
	}

	public get input(): DashboardInput {
		return this._input;
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

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: Dimension): void {
	}

	public setInput(input: DashboardInput, options: EditorOptions): TPromise<void> {
		if (this.input && this.input.matches(input)) {
			return TPromise.as(undefined);
		}

		const parentElement = this.getContainer().getHTMLElement();

		super.setInput(input, options);

		$(parentElement).clearChildren();

		if (!input.hasBootstrapped) {
			let container = DOM.$<HTMLElement>('.dashboardEditor');
			container.style.height = '100%';
			this._dashboardContainer = DOM.append(parentElement, container);
			this.input.container = this._dashboardContainer;
			return TPromise.wrap(input.initializedPromise.then(() => this.bootstrapAngular(input)));
		} else {
			this._dashboardContainer = DOM.append(parentElement, this.input.container);
			return TPromise.as<void>(null);
		}
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(input: DashboardInput): void {
		// Get the bootstrap params and perform the bootstrap
		let params: DashboardComponentParams = {
			connection: input.connectionProfile,
			ownerUri: input.uri
		};

		input.hasBootstrapped = true;

		let uniqueSelector = this._bootstrapService.bootstrap(
			DashboardModule,
			this._dashboardContainer,
			DASHBOARD_SELECTOR,
			params,
			input);
		input.setUniqueSelector(uniqueSelector);
	}

	public dispose(): void {
		super.dispose();
	}
}
