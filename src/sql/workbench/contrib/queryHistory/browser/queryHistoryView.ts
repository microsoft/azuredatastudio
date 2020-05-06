/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as errors from 'vs/base/common/errors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { DefaultFilter, DefaultDragAndDrop, DefaultAccessibilityProvider } from 'vs/base/parts/tree/browser/treeDefaults';
import { localize } from 'vs/nls';
import { hide, $, append, show } from 'vs/base/browser/dom';
import { QueryHistoryRenderer } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryRenderer';
import { QueryHistoryDataSource } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryDataSource';
import { QueryHistoryController } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryController';
import { QueryHistoryActionProvider } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryActionProvider';
import { IExpandableTree } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { IQueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryService';
import { QueryHistoryNode } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryNode';
import { QueryHistoryInfo } from 'sql/workbench/services/queryHistory/common/queryHistoryInfo';
import { IAction } from 'vs/base/common/actions';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IOpenerService } from 'vs/platform/opener/common/opener';

/**
 * QueryHistoryView implements the dynamic tree view for displaying Query History
 */
export class QueryHistoryView extends ViewPane {
	private _messages: HTMLElement;
	private _tree: ITree;
	private _actionProvider: QueryHistoryActionProvider;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IQueryHistoryService private readonly queryHistoryService: IQueryHistoryService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
		this._actionProvider = this.instantiationService.createInstance(QueryHistoryActionProvider);
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): void {
		// Add div to display no task executed message
		this._messages = append(container, $('div.no-queries-message'));

		const noQueriesMessage = localize('noQueriesMessage', "No queries to display.");
		append(this._messages, $('span')).innerText = noQueriesMessage;

		this._tree = this._register(this.createQueryHistoryTree(container, this.instantiationService));

		// Theme styler
		this._register(attachListStyler(this._tree, this.themeService));

		this.queryHistoryService.onInfosUpdated((nodes: QueryHistoryInfo[]) => {
			this.refreshTree();
		});

		// Refresh the tree so we correctly update if there were already existing history items
		this.refreshTree();
	}

	/**
	 * Create a task history tree
	 */
	public createQueryHistoryTree(treeContainer: HTMLElement, instantiationService: IInstantiationService): Tree {
		const dataSource = instantiationService.createInstance(QueryHistoryDataSource);
		const renderer = instantiationService.createInstance(QueryHistoryRenderer);
		const controller = instantiationService.createInstance(QueryHistoryController, this._actionProvider);
		const dnd = new DefaultDragAndDrop();
		const filter = new DefaultFilter();
		const sorter = null;
		const accessibilityProvider = new DefaultAccessibilityProvider();

		return new Tree(treeContainer, {
			dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider
		}, {
			indentPixels: 10,
			twistiePixels: 20,
			ariaLabel: localize({ key: 'queryHistory.regTreeAriaLabel', comment: ['QueryHistory'] }, "Query History")
		});
	}

	public refreshTree(): void {
		let selectedElement: any;
		let targetsToExpand: any[];

		if (this._tree) {
			const selection = this._tree.getSelection();
			if (selection && selection.length === 1) {
				selectedElement = <any>selection[0];
			}
			// convert to old VS Code tree interface with expandable methods
			const expandableTree: IExpandableTree = <IExpandableTree>this._tree;
			targetsToExpand = expandableTree.getExpandedElements();
		}

		const nodes: QueryHistoryNode[] = this.queryHistoryService.getQueryHistoryInfos().map(i => new QueryHistoryNode(i));

		if (nodes.length > 0) {
			hide(this._messages);
		} else {
			show(this._messages);
		}

		// Set the tree input - root node is just an empty container node
		const rootNode = new QueryHistoryNode(undefined);
		rootNode.children = nodes;
		rootNode.hasChildren = true;

		this._tree.setInput(rootNode).then(() => {
			// Make sure to expand all folders that were expanded in the previous session
			if (targetsToExpand) {
				this._tree.expandAll(targetsToExpand);
			}
			if (selectedElement) {
				this._tree.select(selectedElement);
			}
		}, errors.onUnexpectedError);
	}

	/**
	 * set the layout of the view
	 */
	public layout(height: number): void {
		this._tree.layout(height);
	}

	/**
	 * set the visibility of the view
	 */
	public setVisible(visible: boolean): void {
		if (visible) {
			this._tree.onVisible();
		} else {
			this._tree.onHidden();
		}
	}


	public getActions(): IAction[] {
		return this._actionProvider.getActions(undefined);
	}
}
