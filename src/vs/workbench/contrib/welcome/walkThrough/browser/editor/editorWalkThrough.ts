/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Action } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { WalkThroughInput, WalkThroughInputOptions } from 'vs/workbench/contrib/welcome/walkThrough/browser/walkThroughInput';
import { Schemas } from 'vs/base/common/network';
import { IEditorInputFactory, EditorInput } from 'vs/workbench/common/editor';

const typeId = 'workbench.editors.walkThroughInput';
const inputOptions: WalkThroughInputOptions = {
	typeId,
	name: localize('editorWalkThrough.title', "Interactive Playground"),
	resource: URI.parse(require.toUrl('./vs_code_editor_walkthrough.md'))
		.with({ scheme: Schemas.walkThrough }),
	telemetryFrom: 'walkThrough'
};

export class EditorWalkThroughAction extends Action {

	public static readonly ID = 'workbench.action.showInteractivePlayground';
	public static readonly LABEL = localize('editorWalkThrough', "Interactive Playground");

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		const input = this.instantiationService.createInstance(WalkThroughInput, inputOptions);
		return this.editorService.openEditor(input, { pinned: true })
			.then(() => void (0));
	}
}

export class EditorWalkThroughInputFactory implements IEditorInputFactory {

	static readonly ID = typeId;

	public serialize(editorInput: EditorInput): string {
		return '{}';
	}

	public deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): WalkThroughInput {
		return instantiationService.createInstance(WalkThroughInput, inputOptions);
	}
}
