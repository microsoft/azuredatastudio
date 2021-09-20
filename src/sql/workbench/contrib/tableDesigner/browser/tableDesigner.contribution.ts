/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TableDesignerInput } from 'sql/workbench/browser/editor/tableDesigner/tableDesignerInput';
import { TableDesignerEditor } from 'sql/workbench/contrib/tableDesigner/browser/tableDesignerEditor';
import { MenuRegistry } from 'vs/platform/actions/common/actions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorDescriptor, IEditorRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions } from 'vs/workbench/common/editor';
import { ACTIVE_GROUP, IEditorService } from 'vs/workbench/services/editor/common/editorService';

CommandsRegistry.registerCommand({
	id: 'tableDesigner.openTestDesigner',
	handler: async (accessor: ServicesAccessor, ...args: any[]): Promise<void> => {
		const instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		const editorService: IEditorService = accessor.get(IEditorService);
		const connectionService: IConnectionManagementService = accessor.get(IConnectionManagementService);

		const tableDesignerInput = instantiationService.createInstance(TableDesignerInput, connectionService.getActiveConnections()[0], undefined);
		editorService.openEditor(tableDesignerInput, { pinned: true }, ACTIVE_GROUP);
	}
});

MenuRegistry.addCommand({
	id: 'tableDesigner.openTestDesigner',
	title: 'open table designer',
	category: 'Test'
});

const tableDesignerDescriptor = EditorDescriptor.create(
	TableDesignerEditor,
	TableDesignerEditor.ID,
	'TableDesignerEditor'
);

Registry.as<IEditorRegistry>(EditorExtensions.Editors)
	.registerEditor(tableDesignerDescriptor, [new SyncDescriptor(TableDesignerInput)]);
