/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';

CommandsRegistry.registerCommand({
	id: 'resourceViewer.newResourceViewer',
	handler: (accessor: ServicesAccessor, ...args: any[]): void => {
		const instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		const editorService: IEditorService = accessor.get(IEditorService);

		const resourceViewerInput = instantiationService.createInstance(ResourceViewerInput);
		editorService.openEditor(resourceViewerInput, { pinned: true }, ACTIVE_GROUP);
	}
});
