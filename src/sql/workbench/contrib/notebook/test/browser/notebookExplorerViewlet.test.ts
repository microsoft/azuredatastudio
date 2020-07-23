/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as Platform from 'vs/platform/registry/common/platform';
import * as Types from 'vs/base/common/types';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry } from 'vs/workbench/common/views';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { NotebookExplorerViewletViewsContribution } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookExplorerViewlet';
import { SearchViewPaneContainer } from 'sql/workbench/contrib/searchViewPane/browser/searchViewPaneContainer';

suite('Notebook Explorer Views', () => {

	const NOTEBOOK_VIEW_CONTAINER = NotebookExplorerViewletViewsContribution.registerViewContainer();

	test('NotebookExplorer Views registration', function () {
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews));
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews));
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getView));

		Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([], NOTEBOOK_VIEW_CONTAINER);

		let oldcount = Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews(NOTEBOOK_VIEW_CONTAINER).length;
		let d: IViewDescriptor = { id: 'notebookView-test-1', name: 'Notebooks', ctorDescriptor: new SyncDescriptor(SearchViewPaneContainer) };
		Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([d], NOTEBOOK_VIEW_CONTAINER);
		let retrieved = Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getView('notebookView-test-1');
		assert(d === retrieved, 'Could not register view :' + d.id + 'Retrieved: ' + retrieved);
		let newCount = Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews(NOTEBOOK_VIEW_CONTAINER).length;
		assert.equal(oldcount + 1, newCount, 'View registration failed');


	});

	test('NotebookExplorer Views should not register duplicate views', function () {
		let d: IViewDescriptor = { id: 'notebookView-test-1', name: 'Notebooks', ctorDescriptor: new SyncDescriptor(SearchViewPaneContainer) };
		assert.throws(() => Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([d], NOTEBOOK_VIEW_CONTAINER));
	});

	test('NotebookExplorer Views deregistration', function () {
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).deregisterViews));
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews));

		let d: IViewDescriptor = { id: 'notebookView-test-1', name: 'Notebooks', ctorDescriptor: new SyncDescriptor(SearchViewPaneContainer) };
		assert.doesNotThrow(() => Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).deregisterViews([d], NOTEBOOK_VIEW_CONTAINER));

	});
});
