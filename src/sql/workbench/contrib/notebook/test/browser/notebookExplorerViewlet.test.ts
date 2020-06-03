/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as Platform from 'vs/platform/registry/common/platform';
import { ViewletDescriptor, Extensions, ViewletRegistry, Viewlet } from 'vs/workbench/browser/viewlet';
import * as Types from 'vs/base/common/types';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry } from 'vs/workbench/common/views';
import { NotebookExplorerViewPaneContainer, NOTEBOOK_VIEW_CONTAINER } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookExplorerViewlet';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

suite('Notebook Explorer Views', () => {

	class NotebookExplorerTestViewlet extends Viewlet {

		constructor() {
			const instantiationService = workbenchInstantiationService();
			super('notebookExplorer', instantiationService.createInstance(NotebookExplorerViewPaneContainer), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
		}

		public layout(dimension: any): void {
			throw new Error('Method not implemented.');
		}

	}

	test('ViewDescriptor API', function () {
		let d = ViewletDescriptor.create(NotebookExplorerTestViewlet, 'id', 'name', 'class', 1);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
		assert.strictEqual(d.cssClass, 'class');
		assert.strictEqual(d.order, 1);
	});

	test('Editor Aware ViewletDescriptor API', function () {
		let d = ViewletDescriptor.create(NotebookExplorerTestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');

		d = ViewletDescriptor.create(NotebookExplorerTestViewlet, 'id', 'name', 'class', 5);
		assert.strictEqual(d.id, 'id');
		assert.strictEqual(d.name, 'name');
	});

	test('NotebookExplorer Views registration', function () {
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews));
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews));
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getView));

		Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([], NOTEBOOK_VIEW_CONTAINER);

		let oldcount = Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews(NOTEBOOK_VIEW_CONTAINER).length;
		let d: IViewDescriptor = { id: 'notebookView-test-1', name: 'Notebooks', ctorDescriptor: new SyncDescriptor(NotebookExplorerViewPaneContainer) };
		Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([d], NOTEBOOK_VIEW_CONTAINER);
		let retrieved = Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getView('notebookView-test-1');
		assert(d === retrieved, 'Could not register view :' + d.id + 'Retrieved: ' + retrieved);
		let newCount = Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews(NOTEBOOK_VIEW_CONTAINER).length;
		assert.equal(oldcount + 1, newCount, 'View registration failed');


	});

	test('NotebookExplorer Views should not register duplicate views', function () {
		let d: IViewDescriptor = { id: 'notebookView-test-1', name: 'Notebooks', ctorDescriptor: new SyncDescriptor(NotebookExplorerViewPaneContainer) };
		assert.throws(() => Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([d], NOTEBOOK_VIEW_CONTAINER));
	});

	test('NotebookExplorer Views deregistration', function () {
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).deregisterViews));
		assert(Types.isFunction(Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).getViews));

		let d: IViewDescriptor = { id: 'notebookView-test-1', name: 'Notebooks', ctorDescriptor: new SyncDescriptor(NotebookExplorerViewPaneContainer) };
		assert.doesNotThrow(() => Platform.Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).deregisterViews([d], NOTEBOOK_VIEW_CONTAINER));

	});

	test('NotebookExplorer Viewlet extension point should not register duplicate viewlets', function () {
		let v1 = ViewletDescriptor.create(NotebookExplorerTestViewlet, 'notebookExplorer-test-id', 'name');
		Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).registerViewlet(v1);
		let oldCount = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets().length;

		let v1Duplicate = ViewletDescriptor.create(NotebookExplorerTestViewlet, 'notebookExplorer-test-id', 'name');
		// Shouldn't register the duplicate.
		Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).registerViewlet(v1Duplicate);

		let newCount = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets().length;
		assert.equal(oldCount, newCount, 'Duplicate registration of views.');

	});

});
