/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerDashboardWidget } from 'sql/platform/dashboard/browser/widgetRegistry';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ExplorerManageAction } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerActions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ItemContextKey } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/explorerContext';

const explorerSchema: IJSONSchema = {
	type: 'object',
};

registerDashboardWidget('explorer-widget', '', explorerSchema);

CommandsRegistry.registerCommand(ExplorerManageAction.ID, (accessor, context) => {
	const instantiationService = accessor.get(IInstantiationService);
	instantiationService.createInstance(ExplorerManageAction, ExplorerManageAction.ID, ExplorerManageAction.LABEL).run(context);
});

MenuRegistry.appendMenuItem(MenuId.ExplorerWidgetContext, {
	command: {
		id: ExplorerManageAction.ID,
		title: ExplorerManageAction.LABEL
	},
	when: ItemContextKey.ItemType.isEqualTo('database'),
	order: 1
});
