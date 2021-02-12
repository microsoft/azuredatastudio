/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ServerTreeRenderer } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { ServerTreeDataSource } from 'sql/workbench/services/objectExplorer/browser/serverTreeDataSource';
import { ServerTreeController } from 'sql/workbench/services/objectExplorer/browser/serverTreeController';
import { ServerTreeActionProvider } from 'sql/workbench/services/objectExplorer/browser/serverTreeActionProvider';
import { DefaultFilter, DefaultAccessibilityProvider, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { IController } from 'vs/base/parts/tree/browser/tree';
import { ServerTreeDragAndDrop, RecentConnectionsDragAndDrop } from 'sql/workbench/services/objectExplorer/browser/dragAndDropController';
import { RecentConnectionDataSource } from 'sql/workbench/services/objectExplorer/browser/recentConnectionDataSource';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IWorkbenchAsyncDataTreeOptions } from 'vs/platform/list/browser/listService';
import { ConnectionProfileGroupRenderer, ConnectionProfileRenderer, TreeNodeRenderer, ServerTreeAccessibilityProvider, ServerTreeKeyboardNavigationLabelProvider } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeRenderer';
import { AsyncServerTreeIdentityProvider } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeIdentityProvider';
import { FuzzyScore } from 'vs/base/common/filters';
import { AsyncServerTreeDelegate } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeDelegate';
import { AsyncRecentConnectionsDragAndDrop, AsyncServerTreeDragAndDrop } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeDragAndDrop';
import { AsyncRecentConnectionTreeDataSource } from 'sql/workbench/services/objectExplorer/browser/asyncRecentConnectionTreeDataSource';
import { AsyncServerTreeDataSource } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeDataSource';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export class TreeCreationUtils {
	/**
	 * Create a Recent Connections tree
	 */
	public static createConnectionTree(treeContainer: HTMLElement, instantiationService: IInstantiationService, configurationService: IConfigurationService, ariaLabel: string, useController?: IController): Tree | AsyncServerTree {
		if (useAsyncServerTree(configurationService)) {
			const dataSource = instantiationService.createInstance(AsyncRecentConnectionTreeDataSource);
			const connectionProfileGroupRender = instantiationService.createInstance(ConnectionProfileGroupRenderer);
			const connectionProfileRenderer = instantiationService.createInstance(ConnectionProfileRenderer, true);
			const treeNodeRenderer = instantiationService.createInstance(TreeNodeRenderer);
			const dnd = instantiationService.createInstance(AsyncRecentConnectionsDragAndDrop);
			const identityProvider = instantiationService.createInstance(AsyncServerTreeIdentityProvider);

			const treeOptions: IWorkbenchAsyncDataTreeOptions<ServerTreeElement, FuzzyScore> = {
				keyboardSupport: true,
				accessibilityProvider: new ServerTreeAccessibilityProvider(ariaLabel),
				keyboardNavigationLabelProvider: instantiationService.createInstance(ServerTreeKeyboardNavigationLabelProvider),
				dnd: dnd,
				identityProvider: identityProvider
			};

			return instantiationService.createInstance(
				AsyncServerTree,
				'ServerTreeView',
				treeContainer,
				new AsyncServerTreeDelegate(),
				[
					connectionProfileGroupRender,
					connectionProfileRenderer,
					treeNodeRenderer
				],
				dataSource,
				treeOptions,
			);
		} else {
			const dataSource = instantiationService.createInstance(RecentConnectionDataSource);
			const renderer = instantiationService.createInstance(ServerTreeRenderer, true);
			const controller = useController ? useController : new DefaultController();
			const dnd = instantiationService.createInstance(RecentConnectionsDragAndDrop);
			const filter = new DefaultFilter();
			const sorter = undefined;
			const accessibilityProvider = new DefaultAccessibilityProvider();

			return new Tree(treeContainer, { dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider },
				{
					indentPixels: 0,
					twistiePixels: 0,
					ariaLabel: nls.localize('treeAriaLabel', "Recent Connections")
				});
		}
	}

	/**
	 * Create a Servers viewlet tree
	 */
	public static createServersTree(treeContainer: HTMLElement,
		instantiationService: IInstantiationService,
		configurationService: IConfigurationService,
		horizontalScrollMode: boolean = false): Tree | AsyncServerTree {

		if (useAsyncServerTree(configurationService)) {
			const dataSource = instantiationService.createInstance(AsyncServerTreeDataSource);
			const connectionProfileGroupRender = instantiationService.createInstance(ConnectionProfileGroupRenderer);
			const connectionProfileRenderer = instantiationService.createInstance(ConnectionProfileRenderer, false);
			const treeNodeRenderer = instantiationService.createInstance(TreeNodeRenderer);
			const dnd = instantiationService.createInstance(AsyncServerTreeDragAndDrop);
			const identityProvider = instantiationService.createInstance(AsyncServerTreeIdentityProvider);

			const treeOptions: IWorkbenchAsyncDataTreeOptions<ServerTreeElement, FuzzyScore> = {
				keyboardSupport: true,
				accessibilityProvider: new ServerTreeAccessibilityProvider(nls.localize('serversAriaLabel', "Servers")),
				keyboardNavigationLabelProvider: instantiationService.createInstance(ServerTreeKeyboardNavigationLabelProvider),
				openOnSingleClick: true,
				openOnFocus: true,
				dnd: dnd,
				identityProvider: identityProvider
			};

			const tree = instantiationService.createInstance(
				AsyncServerTree,
				'ServerTreeView',
				treeContainer,
				new AsyncServerTreeDelegate(),
				[
					connectionProfileGroupRender,
					connectionProfileRenderer,
					treeNodeRenderer
				],
				dataSource,
				treeOptions
			);
			dnd.tree = tree;
			return tree;
		} else {
			const dataSource = instantiationService.createInstance(ServerTreeDataSource);
			const actionProvider = instantiationService.createInstance(ServerTreeActionProvider);
			const renderer = instantiationService.createInstance(ServerTreeRenderer, false);
			const controller = instantiationService.createInstance(ServerTreeController, actionProvider);
			const dnd = instantiationService.createInstance(ServerTreeDragAndDrop);
			const filter = new DefaultFilter();
			const sorter = undefined;
			const accessibilityProvider = new DefaultAccessibilityProvider();

			return new Tree(treeContainer, { dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider },
				{
					indentPixels: 10,
					twistiePixels: 20,
					ariaLabel: nls.localize('treeCreation.regTreeAriaLabel', "Servers"),
					horizontalScrollMode: horizontalScrollMode ? ScrollbarVisibility.Auto : ScrollbarVisibility.Hidden
				});
		}

	}
}

function useAsyncServerTree(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>('workbench.enablePreviewFeatures') && configurationService.getValue<boolean>('serverTree.useAsyncServerTree');
}
