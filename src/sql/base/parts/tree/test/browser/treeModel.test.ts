/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as _ from 'sql/base/parts/tree/browser/tree';
import * as model from 'sql/base/parts/tree/browser/treeModel';
import * as TreeDefaults from 'sql/base/parts/tree/browser/treeDefaults';
import { Event, Emitter } from 'vs/base/common/event';
import { timeout } from 'vs/base/common/async';
import { Disposable } from 'vs/base/common/lifecycle';

class FakeRenderer {

	public getHeight(tree: _.ITree, element: any): number {
		return 20;
	}

	public getTemplateId(tree: _.ITree, element: any): string {
		return 'fake';
	}

	public renderTemplate(tree: _.ITree, templateId: string, container: any): any {
		return null;
	}

	public renderElement(tree: _.ITree, element: any, templateId: string, templateData: any): void {
		// noop
	}

	public disposeTemplate(tree: _.ITree, templateId: string, templateData: any): void {
		// noop
	}
}

class TreeContext implements _.ITreeContext {

	public tree: _.ITree = null!;
	public options: _.ITreeOptions = { autoExpandSingleChildren: true };
	public dataSource: _.IDataSource;
	public renderer: _.IRenderer;
	public controller?: _.IController;
	public dnd?: _.IDragAndDrop;
	public filter: _.IFilter;
	public sorter: _.ISorter;

	constructor(public configuration: _.ITreeConfiguration) {
		this.dataSource = configuration.dataSource;
		this.renderer = configuration.renderer || new FakeRenderer();
		this.controller = configuration.controller;
		this.dnd = configuration.dnd;
		this.filter = configuration.filter || new TreeDefaults.DefaultFilter();
		this.sorter = configuration.sorter || new TreeDefaults.DefaultSorter();
	}
}

class TreeModel extends model.TreeModel {

	constructor(configuration: _.ITreeConfiguration) {
		super(new TreeContext(configuration));
	}
}

class EventCounter {

	private listeners: lifecycle.IDisposable[];
	private _count: number;

	constructor() {
		this.listeners = [];
		this._count = 0;
	}

	public listen<T>(event: Event<T>, fn: ((e: T) => void) | null = null): () => void {
		let r = event(data => {
			this._count++;
			if (fn) {
				fn(data);
			}
		});

		this.listeners.push(r);

		return () => {
			let idx = this.listeners.indexOf(r);
			if (idx > -1) {
				this.listeners.splice(idx, 1);
				r.dispose();
			}
		};
	}

	public up(): void {
		this._count++;
	}

	public get count(): number {
		return this._count;
	}

	public dispose(): void {
		this.listeners = lifecycle.dispose(this.listeners);
		this._count = -1;
	}
}

const SAMPLE: any = {
	ONE: { id: 'one' },

	AB: {
		id: 'ROOT', children: [
			{
				id: 'a', children: [
					{ id: 'aa' },
					{ id: 'ab' }
				]
			},
			{ id: 'b' },
			{
				id: 'c', children: [
					{ id: 'ca' },
					{ id: 'cb' }
				]
			}
		]
	},

	DEEP: {
		id: 'ROOT', children: [
			{
				id: 'a', children: [
					{
						id: 'x', children: [
							{ id: 'xa' },
							{ id: 'xb' },
						]
					}
				]
			},
			{ id: 'b' }
		]
	},

	DEEP2: {
		id: 'ROOT', children: [
			{
				id: 'a', children: [
					{
						id: 'x', children: [
							{ id: 'xa' },
							{ id: 'xb' },
						]
					},
					{ id: 'y' }
				]
			},
			{ id: 'b' }
		]
	}
};

class TestDataSource implements _.IDataSource {
	public getId(tree: _.ITree, element: any): string {
		return element.id;
	}

	public hasChildren(tree: _.ITree, element: any): boolean {
		return !!element.children;
	}

	public getChildren(tree: _.ITree, element: any): Promise<any> {
		return Promise.resolve(element.children);
	}

	public getParent(tree: _.ITree, element: any): Promise<any> {
		throw new Error('Not implemented');
	}
}

suite('TreeModel', () => {
	let model: model.TreeModel;
	let counter: EventCounter;

	setup(() => {
		counter = new EventCounter();
		model = new TreeModel({
			dataSource: new TestDataSource()
		});
	});

	teardown(() => {
		counter.dispose();
		model.dispose();
	});

	test('setInput, getInput', () => {
		model.setInput(SAMPLE.ONE);
		assert.strictEqual(model.getInput(), SAMPLE.ONE);
	});

	test('refresh() refreshes all', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			counter.listen(model.onRefresh); // 1
			counter.listen(model.onDidRefresh); // 1
			counter.listen(model.onDidRefreshItem); // 4
			counter.listen(model.onRefreshItemChildren); // 1
			counter.listen(model.onDidRefreshItemChildren); // 1
			return model.refresh(null);
		}).then(() => {
			assert.strictEqual(counter.count, 8);
		});
	});

	test('refresh(root) refreshes all', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			counter.listen(model.onRefresh); // 1
			counter.listen(model.onDidRefresh); // 1
			counter.listen(model.onDidRefreshItem); // 4
			counter.listen(model.onRefreshItemChildren); // 1
			counter.listen(model.onDidRefreshItemChildren); // 1
			return model.refresh(SAMPLE.AB);
		}).then(() => {
			assert.strictEqual(counter.count, 8);
		});
	});

	test('refresh(root, false) refreshes the root', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			counter.listen(model.onRefresh); // 1
			counter.listen(model.onDidRefresh); // 1
			counter.listen(model.onDidRefreshItem); // 1
			counter.listen(model.onRefreshItemChildren); // 1
			counter.listen(model.onDidRefreshItemChildren); // 1
			return model.refresh(SAMPLE.AB, false);
		}).then(() => {
			assert.strictEqual(counter.count, 5);
		});
	});

	test('refresh(collapsed element) does not refresh descendants', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			counter.listen(model.onRefresh); // 1
			counter.listen(model.onDidRefresh); // 1
			counter.listen(model.onDidRefreshItem); // 1
			counter.listen(model.onRefreshItemChildren); // 0
			counter.listen(model.onDidRefreshItemChildren); // 0
			return model.refresh(SAMPLE.AB.children[0]);
		}).then(() => {
			assert.strictEqual(counter.count, 3);
		});
	});

	test('refresh(expanded element) refreshes the element and descendants', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expand(SAMPLE.AB.children[0]).then(() => {
				counter.listen(model.onRefresh); // 1
				counter.listen(model.onDidRefresh); // 1
				counter.listen(model.onDidRefreshItem); // 3
				counter.listen(model.onRefreshItemChildren); // 1
				counter.listen(model.onDidRefreshItemChildren); // 1
				return model.refresh(SAMPLE.AB.children[0]);
			});
		}).then(() => {
			assert.strictEqual(counter.count, 7);
		});
	});

	test('refresh(element, false) refreshes the element', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expand(SAMPLE.AB.children[0]).then(() => {
				counter.listen(model.onRefresh); // 1
				counter.listen(model.onDidRefresh); // 1
				counter.listen(model.onDidRefreshItem, item => { // 1
					assert.strictEqual(item.id, 'a');
					counter.up();
				});
				counter.listen(model.onRefreshItemChildren); // 1
				counter.listen(model.onDidRefreshItemChildren); // 1
				return model.refresh(SAMPLE.AB.children[0], false);
			});
		}).then(() => {
			assert.strictEqual(counter.count, 6);
		});
	});

	test('depths', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expandAll(['a', 'c']).then(() => {
				counter.listen(model.onDidRefreshItem, item => {
					switch (item.id) {
						case 'ROOT': assert.strictEqual(item.getDepth(), 0); break;
						case 'a': assert.strictEqual(item.getDepth(), 1); break;
						case 'aa': assert.strictEqual(item.getDepth(), 2); break;
						case 'ab': assert.strictEqual(item.getDepth(), 2); break;
						case 'b': assert.strictEqual(item.getDepth(), 1); break;
						case 'c': assert.strictEqual(item.getDepth(), 1); break;
						case 'ca': assert.strictEqual(item.getDepth(), 2); break;
						case 'cb': assert.strictEqual(item.getDepth(), 2); break;
						default: return;
					}
					counter.up();
				});

				return model.refresh();
			});
		}).then(() => {
			assert.strictEqual(counter.count, 16);
		});
	});

	test('intersections', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expandAll(['a', 'c']).then(() => {
				// going internals
				const r = (<any>model).registry;

				assert(r.getItem('a').intersects(r.getItem('a')));
				assert(r.getItem('a').intersects(r.getItem('aa')));
				assert(r.getItem('a').intersects(r.getItem('ab')));
				assert(r.getItem('aa').intersects(r.getItem('a')));
				assert(r.getItem('ab').intersects(r.getItem('a')));
				assert(!r.getItem('aa').intersects(r.getItem('ab')));
				assert(!r.getItem('a').intersects(r.getItem('b')));
				assert(!r.getItem('a').intersects(r.getItem('c')));
				assert(!r.getItem('a').intersects(r.getItem('ca')));
				assert(!r.getItem('aa').intersects(r.getItem('ca')));
			});
		});
	});
});

suite('TreeModel - TreeNavigator', () => {
	let model: model.TreeModel;
	let counter: EventCounter;

	setup(() => {
		counter = new EventCounter();
		model = new TreeModel({
			dataSource: new TestDataSource()
		});
	});

	teardown(() => {
		counter.dispose();
		model.dispose();
	});

	test('next()', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator();
			assert.strictEqual(nav.next()!.id, 'a');
			assert.strictEqual(nav.next()!.id, 'b');
			assert.strictEqual(nav.next()!.id, 'c');
			assert.strictEqual(nav.next() && false, null);
		});
	});

	test('previous()', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator();

			nav.next();
			nav.next();

			assert.strictEqual(nav.next()!.id, 'c');
			assert.strictEqual(nav.previous()!.id, 'b');
			assert.strictEqual(nav.previous()!.id, 'a');
			assert.strictEqual(nav.previous() && false, null);
		});
	});

	test('parent()', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expandAll([{ id: 'a' }, { id: 'c' }]).then(() => {
				const nav = model.getNavigator();

				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.parent()!.id, 'a');

				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.parent()!.id, 'a');

				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next()!.id, 'ca');
				assert.strictEqual(nav.parent()!.id, 'c');

				assert.strictEqual(nav.parent() && false, null);
			});
		});
	});

	test('next() - scoped', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator(SAMPLE.AB.children[0]);
			return model.expand({ id: 'a' }).then(() => {
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next() && false, null);
			});
		});
	});

	test('previous() - scoped', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator(SAMPLE.AB.children[0]);
			return model.expand({ id: 'a' }).then(() => {
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.previous()!.id, 'aa');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('parent() - scoped', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expandAll([{ id: 'a' }, { id: 'c' }]).then(() => {
				const nav = model.getNavigator(SAMPLE.AB.children[0]);

				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.parent() && false, null);
			});
		});
	});

	test('next() - non sub tree only', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator(SAMPLE.AB.children[0], false);
			return model.expand({ id: 'a' }).then(() => {
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next() && false, null);
			});
		});
	});

	test('previous() - non sub tree only', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator(SAMPLE.AB.children[0], false);
			return model.expand({ id: 'a' }).then(() => {
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.previous()!.id, 'b');
				assert.strictEqual(nav.previous()!.id, 'ab');
				assert.strictEqual(nav.previous()!.id, 'aa');
				assert.strictEqual(nav.previous()!.id, 'a');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('parent() - non sub tree only', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expandAll([{ id: 'a' }, { id: 'c' }]).then(() => {
				const nav = model.getNavigator(SAMPLE.AB.children[0], false);

				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.parent()!.id, 'a');
				assert.strictEqual(nav.parent() && false, null);
			});
		});
	});

	test('deep next() - scoped', () => {
		return model.setInput(SAMPLE.DEEP).then(() => {
			return model.expand(SAMPLE.DEEP.children[0]).then(() => {
				return model.expand(SAMPLE.DEEP.children[0].children[0]).then(() => {
					const nav = model.getNavigator(SAMPLE.DEEP.children[0].children[0]);
					assert.strictEqual(nav.next()!.id, 'xa');
					assert.strictEqual(nav.next()!.id, 'xb');
					assert.strictEqual(nav.next() && false, null);
				});
			});
		});
	});

	test('deep previous() - scoped', () => {
		return model.setInput(SAMPLE.DEEP).then(() => {
			return model.expand(SAMPLE.DEEP.children[0]).then(() => {
				return model.expand(SAMPLE.DEEP.children[0].children[0]).then(() => {
					const nav = model.getNavigator(SAMPLE.DEEP.children[0].children[0]);
					assert.strictEqual(nav.next()!.id, 'xa');
					assert.strictEqual(nav.next()!.id, 'xb');
					assert.strictEqual(nav.previous()!.id, 'xa');
					assert.strictEqual(nav.previous() && false, null);
				});
			});
		});
	});

	test('last()', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.expandAll([{ id: 'a' }, { id: 'c' }]).then(() => {
				const nav = model.getNavigator();
				assert.strictEqual(nav.last()!.id, 'cb');
			});
		});
	});
});

suite('TreeModel - Expansion', () => {
	let model: model.TreeModel;
	let counter: EventCounter;

	setup(() => {
		counter = new EventCounter();
		model = new TreeModel({
			dataSource: new TestDataSource()
		});
	});

	teardown(() => {
		counter.dispose();
		model.dispose();
	});

	test('collapse, expand', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			counter.listen(model.onExpandItem, (e) => {
				assert.strictEqual(e.item.id, 'a');
				const nav = model.getNavigator(e.item);
				assert.strictEqual(nav.next() && false, null);
			});

			counter.listen(model.onDidExpandItem, (e) => {
				assert.strictEqual(e.item.id, 'a');
				const nav = model.getNavigator(e.item);
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next() && false, null);
			});

			assert(!model.isExpanded(SAMPLE.AB.children[0]));

			let nav = model.getNavigator();
			assert.strictEqual(nav.next()!.id, 'a');
			assert.strictEqual(nav.next()!.id, 'b');
			assert.strictEqual(nav.next()!.id, 'c');
			assert.strictEqual(nav.next() && false, null);

			assert.strictEqual(model.getExpandedElements().length, 0);

			return model.expand(SAMPLE.AB.children[0]).then(() => {
				assert(model.isExpanded(SAMPLE.AB.children[0]));

				nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next() && false, null);

				const expandedElements = model.getExpandedElements();
				assert.strictEqual(expandedElements.length, 1);
				assert.strictEqual(expandedElements[0].id, 'a');

				assert.strictEqual(counter.count, 2);
			});
		});
	});

	test('toggleExpansion', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			assert(!model.isExpanded(SAMPLE.AB.children[0]));

			return model.toggleExpansion(SAMPLE.AB.children[0]).then(() => {
				assert(model.isExpanded(SAMPLE.AB.children[0]));
				assert(!model.isExpanded(SAMPLE.AB.children[0].children[0]));

				return model.toggleExpansion(SAMPLE.AB.children[0].children[0]).then(() => {
					assert(!model.isExpanded(SAMPLE.AB.children[0].children[0]));

					return model.toggleExpansion(SAMPLE.AB.children[0]).then(() => {
						assert(!model.isExpanded(SAMPLE.AB.children[0]));
					});
				});
			});
		});
	});

	test('collapseAll', () => {
		return model.setInput(SAMPLE.DEEP2).then(() => {
			return model.expand(SAMPLE.DEEP2.children[0]).then(() => {
				return model.expand(SAMPLE.DEEP2.children[0].children[0]).then(() => {

					assert(model.isExpanded(SAMPLE.DEEP2.children[0]));
					assert(model.isExpanded(SAMPLE.DEEP2.children[0].children[0]));

					return model.collapseAll().then(() => {
						assert(!model.isExpanded(SAMPLE.DEEP2.children[0]));

						return model.expand(SAMPLE.DEEP2.children[0]).then(() => {
							assert(!model.isExpanded(SAMPLE.DEEP2.children[0].children[0]));
						});
					});
				});
			});
		});
	});

	test('auto expand single child folders', () => {
		return model.setInput(SAMPLE.DEEP).then(() => {
			return model.expand(SAMPLE.DEEP.children[0]).then(() => {
				assert(model.isExpanded(SAMPLE.DEEP.children[0]));
				assert(model.isExpanded(SAMPLE.DEEP.children[0].children[0]));
			});
		});
	});

	test('expand can trigger refresh', () => {
		// MUnit.expect(16);
		return model.setInput(SAMPLE.AB).then(() => {

			assert(!model.isExpanded(SAMPLE.AB.children[0]));

			let nav = model.getNavigator();
			assert.strictEqual(nav.next()!.id, 'a');
			assert.strictEqual(nav.next()!.id, 'b');
			assert.strictEqual(nav.next()!.id, 'c');
			assert.strictEqual(nav.next() && false, null);

			const f: () => void = counter.listen(model.onRefreshItemChildren, (e) => {
				assert.strictEqual(e.item.id, 'a');
				f();
			});

			const g: () => void = counter.listen(model.onDidRefreshItemChildren, (e) => {
				assert.strictEqual(e.item.id, 'a');
				g();
			});

			return model.expand(SAMPLE.AB.children[0]).then(() => {
				assert(model.isExpanded(SAMPLE.AB.children[0]));

				nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next() && false, null);

				assert.strictEqual(counter.count, 2);
			});
		});
	});

	test('top level collapsed', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			return model.collapseAll([{ id: 'a' }, { id: 'b' }, { id: 'c' }]).then(() => {
				const nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.previous()!.id, 'b');
				assert.strictEqual(nav.previous()!.id, 'a');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('shouldAutoexpand', () => {
		// setup
		const model = new TreeModel({
			dataSource: {
				getId: (_, e) => e,
				hasChildren: (_, e) => true,
				getChildren: (_, e) => {
					if (e === 'root') { return Promise.resolve(['a', 'b', 'c']); }
					if (e === 'b') { return Promise.resolve(['b1']); }
					return Promise.resolve([]);
				},
				getParent: (_, e): Promise<any> => { throw new Error('not implemented'); },
				shouldAutoexpand: (_, e) => e === 'b'
			}
		});

		return model.setInput('root').then(() => {
			return model.refresh('root', true);
		}).then(() => {
			assert(!model.isExpanded('a'));
			assert(model.isExpanded('b'));
			assert(!model.isExpanded('c'));
		});
	});
});

class TestFilter implements _.IFilter {

	public fn: (element: any) => boolean;

	constructor() {
		this.fn = () => true;
	}

	public isVisible(tree: _.ITree, element: any): boolean {
		return this.fn(element);
	}
}

suite('TreeModel - Filter', () => {
	let model: model.TreeModel;
	let counter: EventCounter;
	let filter: TestFilter;

	setup(() => {
		counter = new EventCounter();
		filter = new TestFilter();
		model = new TreeModel({
			dataSource: new TestDataSource(),
			filter: filter
		});
	});

	teardown(() => {
		counter.dispose();
		model.dispose();
	});

	test('no filter', () => {
		return model.setInput(SAMPLE.AB).then(() => {

			return model.expandAll([{ id: 'a' }, { id: 'c' }]).then(() => {
				const nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next()!.id, 'ca');
				assert.strictEqual(nav.next()!.id, 'cb');

				assert.strictEqual(nav.previous()!.id, 'ca');
				assert.strictEqual(nav.previous()!.id, 'c');
				assert.strictEqual(nav.previous()!.id, 'b');
				assert.strictEqual(nav.previous()!.id, 'ab');
				assert.strictEqual(nav.previous()!.id, 'aa');
				assert.strictEqual(nav.previous()!.id, 'a');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('filter all', () => {
		filter.fn = () => false;

		return model.setInput(SAMPLE.AB).then(() => {
			return model.refresh().then(() => {
				const nav = model.getNavigator();
				assert.strictEqual(nav.next() && false, null);
			});
		});
	});

	test('simple filter', () => {
		// hide elements that do not start with 'a'
		filter.fn = (e) => e.id[0] === 'a';

		return model.setInput(SAMPLE.AB).then(() => {
			return model.expand({ id: 'a' }).then(() => {

				const nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'ab');
				assert.strictEqual(nav.previous()!.id, 'aa');
				assert.strictEqual(nav.previous()!.id, 'a');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('simple filter 2', () => {
		// hide 'ab'
		filter.fn = (e) => e.id !== 'ab';

		return model.setInput(SAMPLE.AB).then(() => {
			return model.expand({ id: 'a' }).then(() => {
				const nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'a');
				assert.strictEqual(nav.next()!.id, 'aa');
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next() && false, null);
			});
		});
	});

	test('simple filter, opposite', () => {
		// hide elements that start with 'a'
		filter.fn = (e) => e.id[0] !== 'a';

		return model.setInput(SAMPLE.AB).then(() => {
			return model.expand({ id: 'c' }).then(() => {

				const nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next()!.id, 'ca');
				assert.strictEqual(nav.next()!.id, 'cb');
				assert.strictEqual(nav.previous()!.id, 'ca');
				assert.strictEqual(nav.previous()!.id, 'c');
				assert.strictEqual(nav.previous()!.id, 'b');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('simple filter, mischieving', () => {
		// hide the element 'a'
		filter.fn = (e) => e.id !== 'a';

		return model.setInput(SAMPLE.AB).then(() => {
			return model.expand({ id: 'c' }).then(() => {

				const nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'b');
				assert.strictEqual(nav.next()!.id, 'c');
				assert.strictEqual(nav.next()!.id, 'ca');
				assert.strictEqual(nav.next()!.id, 'cb');
				assert.strictEqual(nav.previous()!.id, 'ca');
				assert.strictEqual(nav.previous()!.id, 'c');
				assert.strictEqual(nav.previous()!.id, 'b');
				assert.strictEqual(nav.previous() && false, null);
			});
		});
	});

	test('simple filter & previous', () => {
		// hide 'b'
		filter.fn = (e) => e.id !== 'b';

		return model.setInput(SAMPLE.AB).then(() => {
			const nav = model.getNavigator({ id: 'c' }, false);
			assert.strictEqual(nav.previous()!.id, 'a');
			assert.strictEqual(nav.previous() && false, null);
		});
	});
});

suite('TreeModel - Traits', () => {
	let model: model.TreeModel;
	let counter: EventCounter;

	setup(() => {
		counter = new EventCounter();
		model = new TreeModel({
			dataSource: new TestDataSource()
		});
	});

	teardown(() => {
		counter.dispose();
		model.dispose();
	});

	test('Selection', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			assert.strictEqual(model.getSelection().length, 0);
			model.select(SAMPLE.AB.children[1]);
			assert(model.isSelected(SAMPLE.AB.children[1]));
			assert.strictEqual(model.getSelection().length, 1);
			model.select(SAMPLE.AB.children[0]);
			assert(model.isSelected(SAMPLE.AB.children[0]));
			assert.strictEqual(model.getSelection().length, 2);
			model.select(SAMPLE.AB.children[2]);
			assert(model.isSelected(SAMPLE.AB.children[2]));
			assert.strictEqual(model.getSelection().length, 3);
			model.deselect(SAMPLE.AB.children[0]);
			assert(!model.isSelected(SAMPLE.AB.children[0]));
			assert.strictEqual(model.getSelection().length, 2);
			model.setSelection([]);
			assert(!model.isSelected(SAMPLE.AB.children[0]));
			assert(!model.isSelected(SAMPLE.AB.children[1]));
			assert(!model.isSelected(SAMPLE.AB.children[2]));
			assert.strictEqual(model.getSelection().length, 0);
			model.selectAll([SAMPLE.AB.children[0], SAMPLE.AB.children[1], SAMPLE.AB.children[2]]);
			assert.strictEqual(model.getSelection().length, 3);
			model.select(SAMPLE.AB.children[0]);
			assert.strictEqual(model.getSelection().length, 3);
			model.deselectAll([SAMPLE.AB.children[0], SAMPLE.AB.children[1], SAMPLE.AB.children[2]]);
			assert.strictEqual(model.getSelection().length, 0);
			model.deselect(SAMPLE.AB.children[0]);
			assert.strictEqual(model.getSelection().length, 0);

			model.setSelection([SAMPLE.AB.children[0]]);
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[0]));
			assert(!model.isSelected(SAMPLE.AB.children[1]));
			assert(!model.isSelected(SAMPLE.AB.children[2]));

			model.setSelection([SAMPLE.AB.children[0], SAMPLE.AB.children[1], SAMPLE.AB.children[2]]);
			assert.strictEqual(model.getSelection().length, 3);
			assert(model.isSelected(SAMPLE.AB.children[0]));
			assert(model.isSelected(SAMPLE.AB.children[1]));
			assert(model.isSelected(SAMPLE.AB.children[2]));

			model.setSelection([SAMPLE.AB.children[1], SAMPLE.AB.children[2]]);
			assert.strictEqual(model.getSelection().length, 2);
			assert(!model.isSelected(SAMPLE.AB.children[0]));
			assert(model.isSelected(SAMPLE.AB.children[1]));
			assert(model.isSelected(SAMPLE.AB.children[2]));

			model.setSelection([]);
			assert.deepStrictEqual(model.getSelection(), []);
			assert.strictEqual(model.getSelection().length, 0);
			assert(!model.isSelected(SAMPLE.AB.children[0]));
			assert(!model.isSelected(SAMPLE.AB.children[1]));
			assert(!model.isSelected(SAMPLE.AB.children[2]));

			model.selectNext();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[0]));

			model.selectNext();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[1]));

			model.selectNext();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[2]));

			model.selectNext();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[2]));

			model.selectPrevious();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[1]));

			model.selectPrevious();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[0]));

			model.selectPrevious();
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[0]));

			model.selectNext(2);
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[2]));

			model.selectPrevious(4);
			assert.strictEqual(model.getSelection().length, 1);
			assert(model.isSelected(SAMPLE.AB.children[0]));

			assert.strictEqual(model.isSelected(SAMPLE.AB.children[0]), true);
			assert.strictEqual(model.isSelected(SAMPLE.AB.children[2]), false);
		});
	});

	test('Focus', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			assert(!model.getFocus());
			model.setFocus(SAMPLE.AB.children[1]);
			assert(model.isFocused(SAMPLE.AB.children[1]));
			assert(model.getFocus());
			model.setFocus(SAMPLE.AB.children[0]);
			assert(model.isFocused(SAMPLE.AB.children[0]));
			assert(model.getFocus());
			model.setFocus(SAMPLE.AB.children[2]);
			assert(model.isFocused(SAMPLE.AB.children[2]));
			assert(model.getFocus());
			model.setFocus();
			assert(!model.isFocused(SAMPLE.AB.children[0]));
			assert(!model.isFocused(SAMPLE.AB.children[1]));
			assert(!model.isFocused(SAMPLE.AB.children[2]));
			assert(!model.getFocus());

			model.setFocus(SAMPLE.AB.children[0]);
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[0]));
			assert(!model.isFocused(SAMPLE.AB.children[1]));
			assert(!model.isFocused(SAMPLE.AB.children[2]));

			model.setFocus();
			assert(!model.getFocus());
			assert(!model.isFocused(SAMPLE.AB.children[0]));
			assert(!model.isFocused(SAMPLE.AB.children[1]));
			assert(!model.isFocused(SAMPLE.AB.children[2]));

			model.focusNext();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[0]));

			model.focusNext();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[1]));

			model.focusNext();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[2]));

			model.focusNext();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[2]));

			model.focusPrevious();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[1]));

			model.focusPrevious();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[0]));

			model.focusPrevious();
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[0]));

			model.focusNext(2);
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[2]));

			model.focusPrevious(4);
			assert(model.getFocus());
			assert(model.isFocused(SAMPLE.AB.children[0]));

			assert.strictEqual(model.isFocused(SAMPLE.AB.children[0]), true);
			assert.strictEqual(model.isFocused(SAMPLE.AB.children[2]), false);

			model.focusFirst();
			assert(model.isFocused(SAMPLE.AB.children[0]));
			model.focusNth(0);
			assert(model.isFocused(SAMPLE.AB.children[0]));
			model.focusNth(1);
			assert(model.isFocused(SAMPLE.AB.children[1]));
		});
	});

	test('Highlight', () => {
		return model.setInput(SAMPLE.AB).then(() => {
			assert(!model.getHighlight());
			model.setHighlight(SAMPLE.AB.children[1]);
			assert(model.isHighlighted(SAMPLE.AB.children[1]));
			assert(model.getHighlight());
			model.setHighlight(SAMPLE.AB.children[0]);
			assert(model.isHighlighted(SAMPLE.AB.children[0]));
			assert(model.getHighlight());
			model.setHighlight(SAMPLE.AB.children[2]);
			assert(model.isHighlighted(SAMPLE.AB.children[2]));
			assert(model.getHighlight());
			model.setHighlight();
			assert(!model.isHighlighted(SAMPLE.AB.children[0]));
			assert(!model.isHighlighted(SAMPLE.AB.children[1]));
			assert(!model.isHighlighted(SAMPLE.AB.children[2]));
			assert(!model.getHighlight());

			model.setHighlight(SAMPLE.AB.children[0]);
			assert(model.getHighlight());
			assert(model.isHighlighted(SAMPLE.AB.children[0]));
			assert(!model.isHighlighted(SAMPLE.AB.children[1]));
			assert(!model.isHighlighted(SAMPLE.AB.children[2]));

			assert.strictEqual(model.isHighlighted(SAMPLE.AB.children[0]), true);
			assert.strictEqual(model.isHighlighted(SAMPLE.AB.children[2]), false);

			model.setHighlight();
			assert(!model.getHighlight());
			assert(!model.isHighlighted(SAMPLE.AB.children[0]));
			assert(!model.isHighlighted(SAMPLE.AB.children[1]));
			assert(!model.isHighlighted(SAMPLE.AB.children[2]));
		});
	});
});

class DynamicModel extends Disposable implements _.IDataSource {

	private data: any;
	public promiseFactory: { (): Promise<any>; } | null;

	private readonly _onGetChildren = this._register(new Emitter<any>());
	readonly onGetChildren: Event<any> = this._onGetChildren.event;

	private readonly _onDidGetChildren = this._register(new Emitter<any>());
	readonly onDidGetChildren: Event<any> = this._onDidGetChildren.event;

	constructor() {
		super();
		this.data = { root: [] };
		this.promiseFactory = null;
	}

	public addChild(parent: string, child: string): void {
		if (!this.data[parent]) {
			this.data[parent] = [];
		}
		this.data[parent].push(child);
	}

	public removeChild(parent: string, child: string): void {
		this.data[parent].splice(this.data[parent].indexOf(child), 1);
		if (this.data[parent].length === 0) {
			delete this.data[parent];
		}
	}

	public move(element: string, oldParent: string, newParent: string): void {
		this.removeChild(oldParent, element);
		this.addChild(newParent, element);
	}

	public rename(parent: string, oldName: string, newName: string): void {
		this.removeChild(parent, oldName);
		this.addChild(parent, newName);
	}

	public getId(tree: _.ITree, element: any): string {
		return element;
	}

	public hasChildren(tree: _.ITree, element: any): boolean {
		return !!this.data[element];
	}

	public getChildren(tree: _.ITree, element: any): Promise<any> {
		this._onGetChildren.fire(element);
		const result = this.promiseFactory ? this.promiseFactory() : Promise.resolve(null);
		return result.then(() => {
			this._onDidGetChildren.fire(element);
			return Promise.resolve(this.data[element]);
		});
	}

	public getParent(tree: _.ITree, element: any): Promise<any> {
		throw new Error('Not implemented');
	}
}

suite('TreeModel - Dynamic data model', () => {
	let model: model.TreeModel;
	let dataModel: DynamicModel;
	let counter: EventCounter;

	setup(() => {
		counter = new EventCounter();
		dataModel = new DynamicModel();
		model = new TreeModel({
			dataSource: dataModel,
		});
	});

	teardown(() => {
		counter.dispose();
		model.dispose();
	});

	test('items get property disposed', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');
		dataModel.addChild('father', 'son');
		dataModel.addChild('father', 'daughter');
		dataModel.addChild('son', 'baby');

		return model.setInput('root').then(() => {
			return model.expandAll(['grandfather', 'father', 'son']).then(() => {
				dataModel.removeChild('grandfather', 'father');

				const items = ['baby', 'son', 'daughter', 'father'];
				let times = 0;
				counter.listen(model.onDidDisposeItem, item => {
					assert.strictEqual(items[times++], item.id);
				});

				return model.refresh().then(() => {
					assert.strictEqual(times, items.length);
					assert.strictEqual(counter.count, 4);
				});
			});
		});
	});

	test('addChild, removeChild, collapse', () => {
		dataModel.addChild('root', 'super');
		dataModel.addChild('root', 'hyper');
		dataModel.addChild('root', 'mega');

		return model.setInput('root').then(() => {
			let nav = model.getNavigator();
			assert.strictEqual(nav.next()!.id, 'super');
			assert.strictEqual(nav.next()!.id, 'hyper');
			assert.strictEqual(nav.next()!.id, 'mega');
			assert.strictEqual(nav.next() && false, null);

			dataModel.removeChild('root', 'hyper');
			return model.refresh().then(() => {
				nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'super');
				assert.strictEqual(nav.next()!.id, 'mega');
				assert.strictEqual(nav.next() && false, null);

				dataModel.addChild('mega', 'micro');
				dataModel.addChild('mega', 'nano');
				dataModel.addChild('mega', 'pico');

				return model.refresh().then(() => {
					return model.expand('mega').then(() => {
						nav = model.getNavigator();
						assert.strictEqual(nav.next()!.id, 'super');
						assert.strictEqual(nav.next()!.id, 'mega');
						assert.strictEqual(nav.next()!.id, 'micro');
						assert.strictEqual(nav.next()!.id, 'nano');
						assert.strictEqual(nav.next()!.id, 'pico');
						assert.strictEqual(nav.next() && false, null);

						model.collapse('mega');
						nav = model.getNavigator();
						assert.strictEqual(nav.next()!.id, 'super');
						assert.strictEqual(nav.next()!.id, 'mega');
						assert.strictEqual(nav.next() && false, null);
					});
				});
			});
		});
	});

	test('move', () => {
		dataModel.addChild('root', 'super');
		dataModel.addChild('super', 'apples');
		dataModel.addChild('super', 'bananas');
		dataModel.addChild('super', 'pears');
		dataModel.addChild('root', 'hyper');
		dataModel.addChild('root', 'mega');

		return model.setInput('root').then(() => {

			return model.expand('super').then(() => {

				let nav = model.getNavigator();
				assert.strictEqual(nav.next()!.id, 'super');
				assert.strictEqual(nav.next()!.id, 'apples');
				assert.strictEqual(nav.next()!.id, 'bananas');
				assert.strictEqual(nav.next()!.id, 'pears');
				assert.strictEqual(nav.next()!.id, 'hyper');
				assert.strictEqual(nav.next()!.id, 'mega');
				assert.strictEqual(nav.next() && false, null);

				dataModel.move('bananas', 'super', 'hyper');
				dataModel.move('apples', 'super', 'mega');

				return model.refresh().then(() => {

					return model.expandAll(['hyper', 'mega']).then(() => {
						nav = model.getNavigator();
						assert.strictEqual(nav.next()!.id, 'super');
						assert.strictEqual(nav.next()!.id, 'pears');
						assert.strictEqual(nav.next()!.id, 'hyper');
						assert.strictEqual(nav.next()!.id, 'bananas');
						assert.strictEqual(nav.next()!.id, 'mega');
						assert.strictEqual(nav.next()!.id, 'apples');
						assert.strictEqual(nav.next() && false, null);
					});
				});
			});
		});
	});

	test('refreshing grandfather recursively should not refresh collapsed father\'s children immediately', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');
		dataModel.addChild('father', 'son');

		return model.setInput('root').then(() => {
			return model.expand('grandfather').then(() => {
				return model.collapse('father').then(() => {
					let times = 0;
					let listener = dataModel.onGetChildren((element) => {
						times++;
						assert.strictEqual(element, 'grandfather');
					});

					return model.refresh('grandfather').then(() => {
						assert.strictEqual(times, 1);
						listener.dispose();

						listener = dataModel.onGetChildren((element) => {
							times++;
							assert.strictEqual(element, 'father');
						});

						return model.expand('father').then(() => {
							assert.strictEqual(times, 2);
							listener.dispose();
						});
					});
				});
			});
		});
	});

	test('simultaneously refreshing two disjoint elements should parallelize the refreshes', () => {
		dataModel.addChild('root', 'father');
		dataModel.addChild('root', 'mother');
		dataModel.addChild('father', 'son');
		dataModel.addChild('mother', 'daughter');

		return model.setInput('root').then(() => {
			return model.expand('father').then(() => {
				return model.expand('mother').then(() => {

					let nav = model.getNavigator();
					assert.strictEqual(nav.next()!.id, 'father');
					assert.strictEqual(nav.next()!.id, 'son');
					assert.strictEqual(nav.next()!.id, 'mother');
					assert.strictEqual(nav.next()!.id, 'daughter');
					assert.strictEqual(nav.next() && false, null);

					dataModel.removeChild('father', 'son');
					dataModel.removeChild('mother', 'daughter');
					dataModel.addChild('father', 'brother');
					dataModel.addChild('mother', 'sister');

					dataModel.promiseFactory = () => { return timeout(0); };

					let getTimes = 0;
					let gotTimes = 0;
					const getListener = dataModel.onGetChildren((element) => { getTimes++; });
					const gotListener = dataModel.onDidGetChildren((element) => { gotTimes++; });

					const p1 = model.refresh('father');
					assert.strictEqual(getTimes, 1);
					assert.strictEqual(gotTimes, 0);

					const p2 = model.refresh('mother');
					assert.strictEqual(getTimes, 2);
					assert.strictEqual(gotTimes, 0);

					return Promise.all([p1, p2]).then(() => {
						assert.strictEqual(getTimes, 2);
						assert.strictEqual(gotTimes, 2);

						nav = model.getNavigator();
						assert.strictEqual(nav.next()!.id, 'father');
						assert.strictEqual(nav.next()!.id, 'brother');
						assert.strictEqual(nav.next()!.id, 'mother');
						assert.strictEqual(nav.next()!.id, 'sister');
						assert.strictEqual(nav.next() && false, null);

						getListener.dispose();
						gotListener.dispose();
					});
				});
			});
		});
	});

	test('simultaneously recursively refreshing two intersecting elements should concatenate the refreshes - ancestor first', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');
		dataModel.addChild('father', 'son');

		return model.setInput('root').then(() => {
			return model.expand('grandfather').then(() => {
				return model.expand('father').then(() => {
					let nav = model.getNavigator();
					assert.strictEqual(nav.next()!.id, 'grandfather');
					assert.strictEqual(nav.next()!.id, 'father');
					assert.strictEqual(nav.next()!.id, 'son');
					assert.strictEqual(nav.next() && false, null);

					let refreshTimes = 0;
					counter.listen(model.onDidRefreshItem, (e) => { refreshTimes++; });

					let getTimes = 0;
					const getListener = dataModel.onGetChildren((element) => { getTimes++; });

					let gotTimes = 0;
					const gotListener = dataModel.onDidGetChildren((element) => { gotTimes++; });

					const p1Completes: Array<(value?: any) => void> = [];
					dataModel.promiseFactory = () => { return new Promise((c) => { p1Completes.push(c); }); };

					model.refresh('grandfather').then(() => {
						// just a single get
						assert.strictEqual(refreshTimes, 1); // (+1) grandfather
						assert.strictEqual(getTimes, 1);
						assert.strictEqual(gotTimes, 0);

						// unblock the first get
						p1Completes.shift()!();

						// once the first get is unblocked, the second get should appear
						assert.strictEqual(refreshTimes, 2); // (+1) first father refresh
						assert.strictEqual(getTimes, 2);
						assert.strictEqual(gotTimes, 1);

						let p2Complete: () => void;
						dataModel.promiseFactory = () => { return new Promise<void>((c) => { p2Complete = c; }); };
						const p2 = model.refresh('father');

						// same situation still
						assert.strictEqual(refreshTimes, 3); // (+1) second father refresh
						assert.strictEqual(getTimes, 2);
						assert.strictEqual(gotTimes, 1);

						// unblock the second get
						p1Completes.shift()!();

						// the third get should have appeared, it should've been waiting for the second one
						assert.strictEqual(refreshTimes, 4); // (+1) first son request
						assert.strictEqual(getTimes, 3);
						assert.strictEqual(gotTimes, 2);

						p2Complete!();

						// all good
						assert.strictEqual(refreshTimes, 5); // (+1) second son request
						assert.strictEqual(getTimes, 3);
						assert.strictEqual(gotTimes, 3);

						return p2.then(() => {
							nav = model.getNavigator();
							assert.strictEqual(nav.next()!.id, 'grandfather');
							assert.strictEqual(nav.next()!.id, 'father');
							assert.strictEqual(nav.next()!.id, 'son');
							assert.strictEqual(nav.next() && false, null);

							getListener.dispose();
							gotListener.dispose();
						});
					});
				});
			});
		});
	});

	test('refreshing an empty element that adds children should still keep it collapsed', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');

		return model.setInput('root').then(() => {
			return model.expand('grandfather').then(() => {
				return model.expand('father').then(() => {
					assert(!model.isExpanded('father'));

					dataModel.addChild('father', 'son');

					return model.refresh('father').then(() => {
						assert(!model.isExpanded('father'));
					});
				});
			});
		});
	});

	test('refreshing a collapsed element that adds children should still keep it collapsed', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');
		dataModel.addChild('father', 'son');

		return model.setInput('root').then(() => {
			return model.expand('grandfather').then(() => {
				return model.expand('father').then(() => {
					return model.collapse('father').then(() => {
						assert(!model.isExpanded('father'));

						dataModel.addChild('father', 'daughter');

						return model.refresh('father').then(() => {
							assert(!model.isExpanded('father'));
						});
					});
				});
			});
		});
	});

	test('recursively refreshing an ancestor of an expanded element, should keep that element expanded', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');
		dataModel.addChild('father', 'son');

		return model.setInput('root').then(() => {
			return model.expand('grandfather').then(() => {
				return model.expand('father').then(() => {
					assert(model.isExpanded('grandfather'));
					assert(model.isExpanded('father'));

					return model.refresh('grandfather').then(() => {
						assert(model.isExpanded('grandfather'));
						assert(model.isExpanded('father'));
					});
				});
			});
		});
	});

	test('recursively refreshing an ancestor of a collapsed element, should keep that element collapsed', () => {
		dataModel.addChild('root', 'grandfather');
		dataModel.addChild('grandfather', 'father');
		dataModel.addChild('father', 'son');

		return model.setInput('root').then(() => {
			return model.expand('grandfather').then(() => {
				return model.expand('father').then(() => {
					return model.collapse('father').then(() => {
						assert(model.isExpanded('grandfather'));
						assert(!model.isExpanded('father'));

						return model.refresh('grandfather').then(() => {
							assert(model.isExpanded('grandfather'));
							assert(!model.isExpanded('father'));
						});
					});
				});
			});
		});
	});

	test('Bug 10855:[explorer] quickly deleting things causes NPE in tree - intersectsLock should always be called when trying to unlock', () => {
		dataModel.addChild('root', 'father');
		dataModel.addChild('father', 'son');
		dataModel.addChild('root', 'mother');
		dataModel.addChild('mother', 'daughter');

		return model.setInput('root').then(() => {

			// delay expansions and refreshes
			dataModel.promiseFactory = () => { return timeout(0); };

			const promises: Promise<any>[] = [];

			promises.push(model.expand('father'));
			dataModel.removeChild('root', 'father');
			promises.push(model.refresh('root'));

			promises.push(model.expand('mother'));
			dataModel.removeChild('root', 'mother');
			promises.push(model.refresh('root'));

			return Promise.all(promises).then(() => {
				assert(true, 'all good');
			}, (errs) => {
				assert(false, 'should not fail');
			});
		});
	});
});

suite('TreeModel - bugs', () => {
	let counter: EventCounter;

	setup(() => {
		counter = new EventCounter();
	});

	teardown(() => {
		counter.dispose();
	});

	/**
	 * This bug occurs when an item is expanded right during its removal
	 */
	test('Bug 10566:[tree] build viewlet is broken after some time', () => {
		// setup
		let model = new TreeModel({
			dataSource: {
				getId: (_, e) => e,
				hasChildren: (_, e) => e === 'root' || e === 'bart',
				getChildren: (_, e) => {
					if (e === 'root') { return getRootChildren(); }
					if (e === 'bart') { return getBartChildren(); }
					return Promise.resolve([]);
				},
				getParent: (_, e): Promise<any> => { throw new Error('not implemented'); },
			}
		});

		let listeners = <any>[];

		// helpers
		const getGetRootChildren = (children: string[], millis = 0) => () => timeout(millis).then(() => children);
		let getRootChildren = getGetRootChildren(['homer', 'bart', 'lisa', 'marge', 'maggie'], 0);
		const getGetBartChildren = (millis = 0) => () => timeout(millis).then(() => ['milhouse', 'nelson']);
		const getBartChildren = getGetBartChildren(0);

		// item expanding should not exist!
		counter.listen(model.onExpandItem, () => { assert(false, 'should never receive item:expanding event'); });
		counter.listen(model.onDidExpandItem, () => { assert(false, 'should never receive item:expanded event'); });

		return model.setInput('root').then(() => {

			// remove bart
			getRootChildren = getGetRootChildren(['homer', 'lisa', 'marge', 'maggie'], 10);

			// refresh root
			const p1 = model.refresh('root', true).then(() => {
				assert(true);
			}, () => {
				assert(false, 'should never reach this');
			});

			// at the same time, try to expand bart!
			const p2 = model.expand('bart').then(() => {
				assert(false, 'should never reach this');
			}, () => {
				assert(true, 'bart should fail to expand since he was removed meanwhile');
			});

			// what now?
			return Promise.all([p1, p2]);

		}).then(() => {

			// teardown
			while (listeners.length > 0) { listeners.pop()(); }
			listeners = null;
			model.dispose();

			assert.strictEqual(counter.count, 0);
		});
	});

	test('collapsed resolved parent should also update all children visibility on refresh', async function () {
		const counter = new EventCounter();
		const dataModel = new DynamicModel();

		let isSonVisible = true;
		const filter: _.IFilter = {
			isVisible(_, element) {
				return element !== 'son' || isSonVisible;
			}
		};

		const model = new TreeModel({ dataSource: dataModel, filter });

		dataModel.addChild('root', 'father');
		dataModel.addChild('father', 'son');

		await model.setInput('root');
		await model.expand('father');

		let nav = model.getNavigator();
		assert.strictEqual(nav.next()!.id, 'father');
		assert.strictEqual(nav.next()!.id, 'son');
		assert.strictEqual(nav.next(), null);

		await model.collapse('father');
		isSonVisible = false;

		await model.refresh(undefined, true);
		await model.expand('father');

		nav = model.getNavigator();
		assert.strictEqual(nav.next()!.id, 'father');
		assert.strictEqual(nav.next(), null);

		counter.dispose();
		model.dispose();
	});
});
