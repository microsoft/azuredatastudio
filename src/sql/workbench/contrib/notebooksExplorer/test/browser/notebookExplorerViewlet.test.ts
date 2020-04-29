/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as Platform from 'vs/platform/registry/common/platform';
import { ViewletDescriptor, Extensions, ViewletRegistry, Viewlet } from 'vs/workbench/browser/viewlet';
import * as Types from 'vs/base/common/types';
import { workbenchInstantiationService } from 'sql/workbench/test/workbenchTestServices';
import { NotebookExplorerViewPaneContainer } from 'sql/workbench/contrib/notebooksExplorer/browser/notebookExplorerViewlet';

suite('Notebook Explorer Viewlet', () => {

	class NotebookExplorerTestViewlet extends Viewlet {

		constructor() {
			const instantiationService = workbenchInstantiationService();
			super('notebookExplorer', instantiationService.createInstance(NotebookExplorerViewPaneContainer), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
		}

		public layout(dimension: any): void {
			throw new Error('Method not implemented.');
		}

	}

	test('ViewletDescriptor API', function () {
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

	test('NotebookExplorer Viewlet extension point and registration', function () {
		assert(Types.isFunction(Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).registerViewlet));
		assert(Types.isFunction(Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlet));
		assert(Types.isFunction(Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets));

		let oldCount = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets().length;
		let d = ViewletDescriptor.create(NotebookExplorerTestViewlet, 'notebookExplorer-test-id', 'name');
		Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).registerViewlet(d);
		let retrieved = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlet('notebookExplorer-test-id');
		assert(d === retrieved);
		let newCount = Platform.Registry.as<ViewletRegistry>(Extensions.Viewlets).getViewlets().length;
		assert.equal(oldCount + 1, newCount);
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
