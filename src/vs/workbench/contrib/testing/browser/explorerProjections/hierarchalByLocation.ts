/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectTree } from 'vs/base/browser/ui/tree/objectTree';
import { mapFind } from 'vs/base/common/arrays';
import { Emitter } from 'vs/base/common/event';
import { FuzzyScore } from 'vs/base/common/filters';
import { Iterable } from 'vs/base/common/iterator';
import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkspaceFolder, IWorkspaceFoldersChangeEvent } from 'vs/platform/workspace/common/workspace';
import { TestResultState } from 'vs/workbench/api/common/extHostTypes';
import { ByLocationFolderElement, ByLocationTestItemElement } from 'vs/workbench/contrib/testing/browser/explorerProjections/hierarchalNodes';
import { IActionableTestTreeElement, isActionableTestTreeElement, ITestTreeProjection, TestExplorerTreeElement, TestItemTreeElement, TestTreeErrorMessage } from 'vs/workbench/contrib/testing/browser/explorerProjections/index';
import { NodeChangeList, NodeRenderDirective, NodeRenderFn, peersHaveChildren } from 'vs/workbench/contrib/testing/browser/explorerProjections/nodeHelper';
import { IComputedStateAndDurationAccessor, refreshComputedState } from 'vs/workbench/contrib/testing/common/getComputedState';
import { InternalTestItem, TestDiffOpType, TestItemExpandState, TestsDiff } from 'vs/workbench/contrib/testing/common/testCollection';
import { ITestResultService } from 'vs/workbench/contrib/testing/common/testResultService';
import { TestSubscriptionListener } from 'vs/workbench/contrib/testing/common/workspaceTestCollectionService';

const computedStateAccessor: IComputedStateAndDurationAccessor<IActionableTestTreeElement> = {
	getOwnState: i => i instanceof TestItemTreeElement ? i.ownState : TestResultState.Unset,
	getCurrentComputedState: i => i.state,
	setComputedState: (i, s) => i.state = s,

	getCurrentComputedDuration: i => i.duration,
	getOwnDuration: i => i instanceof TestItemTreeElement ? i.ownDuration : undefined,
	setComputedDuration: (i, d) => i.duration = d,

	getChildren: i => Iterable.filter(i.children.values(), isActionableTestTreeElement),
	*getParents(i) {
		for (let parent = i.parent; parent; parent = parent.parent) {
			yield parent;
		}
	},
};

/**
 * Projection that lists tests in their traditional tree view.
 */
export class HierarchicalByLocationProjection extends Disposable implements ITestTreeProjection {
	private readonly updateEmitter = new Emitter<void>();
	protected readonly changes = new NodeChangeList<ByLocationTestItemElement | ByLocationFolderElement>();

	/**
	 * Root folders and contained items.
	 */
	protected readonly folders = new Map<string, {
		root: ByLocationFolderElement;
		items: Map<string, ByLocationTestItemElement>,
	}>();

	/**
	 * Gets root elements of the tree.
	 */
	protected get roots() {
		return Iterable.map(this.folders.values(), f => f.root);
	}

	/**
	 * @inheritdoc
	 */
	public readonly onUpdate = this.updateEmitter.event;

	constructor(protected readonly listener: TestSubscriptionListener, @ITestResultService private readonly results: ITestResultService) {
		super();
		this._register(listener.onDiff(({ folder, diff }) => this.applyDiff(folder.folder, diff)));
		this._register(listener.onFolderChange(this.applyFolderChange, this));

		// when test results are cleared, recalculate all state
		this._register(results.onResultsChanged((evt) => {
			if (!('removed' in evt)) {
				return;
			}

			for (const { items } of this.folders.values()) {
				for (const inTree of [...items.values()].sort((a, b) => b.depth - a.depth)) {
					const lookup = this.results.getStateById(inTree.test.item.extId)?.[1];
					let computed = TestResultState.Unset;
					let ownDuration: number | undefined;
					let updated = false;
					if (lookup) {
						computed = lookup.computedState;
						ownDuration = lookup.ownDuration;
					}

					if (lookup) {
						inTree.ownState = lookup.ownComputedState;
					}

					if (computed !== inTree.state) {
						inTree.state = computed;
						updated = true;
					}

					if (ownDuration !== inTree.ownDuration) {
						inTree.ownDuration = ownDuration;
						updated = true;
					}

					if (updated) {
						this.addUpdated(inTree);
					}
				}
			}

			this.updateEmitter.fire();
		}));

		// when test states change, reflect in the tree
		// todo: optimize this to avoid needing to iterate
		this._register(results.onTestChanged(({ item: result }) => {
			for (const { items } of this.folders.values()) {
				const item = items.get(result.item.extId);
				if (item) {
					item.retired = result.retired;
					item.ownState = result.ownComputedState;
					item.ownDuration = result.ownDuration;
					// For items without children, always use the computed state. They are
					// either leaves (for which it's fine) or nodes where we haven't expanded
					// children and should trust whatever the result service gives us.
					const explicitComputed = item.children.size ? undefined : result.computedState;
					refreshComputedState(computedStateAccessor, item, explicitComputed).forEach(this.addUpdated);
					this.addUpdated(item);
					this.updateEmitter.fire();
				}
			}
		}));

		for (const [folder, collection] of listener.workspaceFolderCollections) {
			const { items } = this.getOrCreateFolderElement(folder.folder);
			for (const node of collection.all) {
				this.storeItem(items, this.createItem(node, folder.folder));
			}
		}

		for (const folder of this.folders.values()) {
			this.changes.addedOrRemoved(folder.root);
		}
	}

	/**
	 * Gets the depth of children to expanded automatically for the node,
	 */
	protected getRevealDepth(element: ByLocationTestItemElement): number | undefined {
		return element.depth === 1 ? 0 : undefined;
	}

	/**
	 * @inheritdoc
	 */
	public getElementByTestId(testId: string): TestItemTreeElement | undefined {
		return mapFind(this.folders.values(), f => f.items.get(testId));
	}

	private applyFolderChange(evt: IWorkspaceFoldersChangeEvent) {
		for (const folder of evt.removed) {
			const existing = this.folders.get(folder.uri.toString());
			if (existing) {
				this.folders.delete(folder.uri.toString());
				this.changes.addedOrRemoved(existing.root);
			}
			this.updateEmitter.fire();
		}
	}

	/**
	 * @inheritdoc
	 */
	private applyDiff(folder: IWorkspaceFolder, diff: TestsDiff) {
		const { items } = this.getOrCreateFolderElement(folder);

		for (const op of diff) {
			switch (op[0]) {
				case TestDiffOpType.Add: {
					const item = this.createItem(op[1], folder);
					this.storeItem(items, item);
					this.changes.addedOrRemoved(item);
					break;
				}

				case TestDiffOpType.Update: {
					const patch = op[1];
					const existing = items.get(patch.extId);
					if (!existing) {
						break;
					}

					existing.update(patch);
					this.addUpdated(existing);
					break;
				}

				case TestDiffOpType.Remove: {
					const toRemove = items.get(op[1]);
					if (!toRemove) {
						break;
					}

					this.changes.addedOrRemoved(toRemove);

					const queue: Iterable<TestExplorerTreeElement>[] = [[toRemove]];
					while (queue.length) {
						for (const item of queue.pop()!) {
							if (item instanceof ByLocationTestItemElement) {
								queue.push(this.unstoreItem(items, item));
							}
						}
					}
				}
			}
		}

		if (diff.length !== 0) {
			this.updateEmitter.fire();
		}
	}

	/**
	 * @inheritdoc
	 */
	public applyTo(tree: ObjectTree<TestExplorerTreeElement, FuzzyScore>) {
		this.changes.applyTo(tree, this.renderNode, () => this.roots);
	}

	/**
	 * @inheritdoc
	 */
	public expandElement(element: TestItemTreeElement, depth: number): void {
		if (!(element instanceof ByLocationTestItemElement)) {
			return;
		}

		if (element.test.expand === TestItemExpandState.NotExpandable) {
			return;
		}

		const folder = element.folder;
		const collection = [...this.listener.workspaceFolderCollections].find(([f]) => f.folder === folder);
		collection?.[1].expand(element.test.item.extId, depth);
	}

	protected createItem(item: InternalTestItem, folder: IWorkspaceFolder): ByLocationTestItemElement {
		const { items, root } = this.getOrCreateFolderElement(folder);
		const parent = item.parent ? items.get(item.parent)! : root;
		return new ByLocationTestItemElement(item, parent, n => this.changes.addedOrRemoved(n));
	}

	protected getOrCreateFolderElement(folder: IWorkspaceFolder) {
		let f = this.folders.get(folder.uri.toString());
		if (!f) {
			f = { root: new ByLocationFolderElement(folder), items: new Map() };
			this.changes.addedOrRemoved(f.root);
			this.folders.set(folder.uri.toString(), f);
		}

		return f;
	}

	protected readonly addUpdated = (item: IActionableTestTreeElement) => {
		const cast = item as ByLocationTestItemElement | ByLocationFolderElement;
		this.changes.updated(cast);
	};

	protected renderNode: NodeRenderFn = (node, recurse) => {
		if (node instanceof TestTreeErrorMessage) {
			return { element: node };
		}

		// Omit the workspace folder or controller root if there are no siblings
		if (node.depth < 2 && !peersHaveChildren(node, () => this.roots)) {
			return NodeRenderDirective.Concat;
		}

		// Omit folders/roots that have no child tests
		if (node.depth < 2 && node.children.size === 0) {
			return NodeRenderDirective.Omit;
		}

		if (!(node instanceof ByLocationTestItemElement)) {
			return { element: node, children: recurse(node.children) };
		}

		return {
			element: node,
			collapsible: node.test.expand !== TestItemExpandState.NotExpandable,
			collapsed: node.test.expand === TestItemExpandState.Expandable ? true : undefined,
			children: recurse(node.children),
		};
	};

	protected unstoreItem(items: Map<string, TestItemTreeElement>, treeElement: ByLocationTestItemElement) {
		const parent = treeElement.parent;
		parent.children.delete(treeElement);
		items.delete(treeElement.test.item.extId);
		if (parent instanceof ByLocationTestItemElement) {
			refreshComputedState(computedStateAccessor, parent).forEach(this.addUpdated);
		}

		return treeElement.children;
	}

	protected storeItem(items: Map<string, TestItemTreeElement>, treeElement: ByLocationTestItemElement) {
		treeElement.parent.children.add(treeElement);
		items.set(treeElement.test.item.extId, treeElement);

		const reveal = this.getRevealDepth(treeElement);
		if (reveal !== undefined) {
			this.expandElement(treeElement, reveal);
		}

		const prevState = this.results.getStateById(treeElement.test.item.extId)?.[1];
		if (prevState) {
			treeElement.retired = prevState.retired;
			treeElement.ownState = prevState.computedState;
			treeElement.ownDuration = prevState.ownDuration;
			refreshComputedState(computedStateAccessor, treeElement).forEach(this.addUpdated);
		}
	}
}
