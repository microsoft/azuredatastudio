/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { TPromise } from 'vs/base/common/winjs.base';
import { EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { DashboardInput } from './dashboardInput';
import { DashboardModule } from './dashboard.module';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { IDashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { DASHBOARD_SELECTOR } from 'sql/parts/dashboard/dashboard.component';
import { ConnectionContextKey } from 'sql/parts/connection/common/connectionContextKey';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { $ } from 'sql/base/browser/builder';

export class DashboardEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.connectiondashboard';
	private _dashboardContainer: HTMLElement;
	protected _input: DashboardInput;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IDashboardService private _dashboardService: IDashboardService,
		@IConnectionManagementService private _connMan: IConnectionManagementService,
		@IStorageService storageService: IStorageService
	) {
		super(DashboardEditor.ID, telemetryService, themeService, storageService);
	}

	public get input(): DashboardInput {
		return this._input;
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

		let profile: IConnectionProfile;
		if (this.input.connectionProfile instanceof ConnectionProfile) {
			profile = this.input.connectionProfile.toIConnectionProfile();
		} else {
			profile = this.input.connectionProfile;
		}
		let serverInfo = this._connMan.getConnectionInfo(this.input.uri).serverInfo;
		this._dashboardService.changeToDashboard({ profile, serverInfo });
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this._dashboardService.layout(dimension);
	}

	public setInput(input: DashboardInput, options: EditorOptions): TPromise<void> {
		if (this.input && this.input.matches(input)) {
			return TPromise.as(undefined);
		}

		const parentElement = this.getContainer();

		super.setInput(input, options, CancellationToken.None);

		$(parentElement).clearChildren();

		if (!input.hasBootstrapped) {
			let container = DOM.$<HTMLElement>('.dashboardEditor');
			container.style.height = '100%';
			this._dashboardContainer = DOM.append(parentElement, container);
			this.input.container = this._dashboardContainer;
			return TPromise.wrap(input.initializedPromise.then(() => this.bootstrapAngular(input)));
		} else {
			this._dashboardContainer = DOM.append(parentElement, this.input.container);
			return TPromise.wrap<void>(null);
		}
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(input: DashboardInput): void {
		// Get the bootstrap params and perform the bootstrap
		let profile: IConnectionProfile;
		if (input.connectionProfile instanceof ConnectionProfile) {
			profile = input.connectionProfile.toIConnectionProfile();
		} else {
			profile = this.input.connectionProfile;
		}
		let serverInfo = this._connMan.getConnectionInfo(this.input.uri).serverInfo;
		this._dashboardService.changeToDashboard({ profile, serverInfo });
		let scopedContextService = this._contextKeyService.createScoped(input.container);
		let connectionContextKey = new ConnectionContextKey(scopedContextService);
		connectionContextKey.set(input.connectionProfile);

		let params: IDashboardComponentParams = {
			connection: input.connectionProfile,
			ownerUri: input.uri,
			scopedContextService,
			connectionContextKey
		};

		input.hasBootstrapped = true;

		let uniqueSelector = bootstrapAngular(this.instantiationService,
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
