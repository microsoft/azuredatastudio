/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorDescriptor, Extensions as EditorExtensions, IEditorRegistry } from 'vs/workbench/browser/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ResourceViewerEditor } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerEditor';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { isString } from 'vs/base/common/types';

CommandsRegistry.registerCommand({
	id: 'resourceViewer.openResourceViewer',
	handler: async (accessor: ServicesAccessor, ...args: any[]): Promise<void> => {
		const instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		const editorService: IEditorService = accessor.get(IEditorService);
		if (!isString(args[0])) {
			throw new Error('First argument must be the ProviderId');
		}

		const resourceViewerInput = instantiationService.createInstance(ResourceViewerInput, args[0]);
		editorService.openEditor(resourceViewerInput, { pinned: true }, ACTIVE_GROUP);
	}
});

const resourceViewerDescriptor = EditorDescriptor.create(
	ResourceViewerEditor,
	ResourceViewerEditor.ID,
	'ResourceViewerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(resourceViewerDescriptor, [new SyncDescriptor(ResourceViewerInput)]);

