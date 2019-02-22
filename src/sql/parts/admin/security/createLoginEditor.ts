/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryEditor';
import * as DOM from 'vs/base/browser/dom';
import { TPromise } from 'vs/base/common/winjs.base';
import { EditorOptions } from 'vs/workbench/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CreateLoginInput } from 'sql/parts/admin/security/createLoginInput';
import { CreateLoginModule } from 'sql/parts/admin/security/createLogin.module';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IMetadataService } from 'sql/platform/metadata/common/metadataService';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { bootstrapAngular, IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { CREATELOGIN_SELECTOR } from 'sql/parts/admin/security/createLogin.component';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';

export class CreateLoginEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.createlogin';

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@IMetadataService private _metadataService: IMetadataService,
		@IScriptingService private _scriptingService: IScriptingService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IStorageService storageService: IStorageService
	) {
		super(CreateLoginEditor.ID, telemetryService, themeService, storageService);
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
	}

	public setInput(input: CreateLoginInput, options: EditorOptions): Thenable<void> {
		if (this.input instanceof CreateLoginInput && this.input.matches(input)) {
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
	private bootstrapAngular(input: CreateLoginInput): void {

		// Get the bootstrap params and perform the bootstrap
		let params: IBootstrapParams = {
			connection: input.getConnectionProfile(),
			ownerUri: input.getUri()
		};
		let uniqueSelector = bootstrapAngular(this.instantiationService,
			CreateLoginModule,
			this.getContainer(),
			CREATELOGIN_SELECTOR,
			params);
		input.setUniqueSelector(uniqueSelector);
	}

	public dispose(): void {
		super.dispose();
	}
}
