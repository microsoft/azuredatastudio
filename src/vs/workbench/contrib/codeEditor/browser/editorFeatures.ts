/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from 'vs/base/common/errors';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { getEditorFeatures } from 'vs/editor/common/editorFeatures';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';

class EditorFeaturesInstantiator extends Disposable implements IWorkbenchContribution {

	private _instantiated = false;

	constructor(
		@ICodeEditorService codeEditorService: ICodeEditorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		super();

		this._register(codeEditorService.onWillCreateCodeEditor(() => this._instantiate()));
		this._register(codeEditorService.onWillCreateDiffEditor(() => this._instantiate()));
		if (codeEditorService.listCodeEditors().length > 0 || codeEditorService.listDiffEditors().length > 0) {
			this._instantiate();
		}
	}

	private _instantiate(): void {
		if (this._instantiated) {
			return;
		}
		this._instantiated = true;

		// Instantiate all editor features
		const editorFeatures = getEditorFeatures();
		for (const feature of editorFeatures) {
			try {
				const instance = this._instantiationService.createInstance(feature);
				if (typeof (<IDisposable>instance).dispose === 'function') {
					this._register((<IDisposable>instance));
				}
			} catch (err) {
				onUnexpectedError(err);
			}
		}
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(EditorFeaturesInstantiator, LifecyclePhase.Ready);
