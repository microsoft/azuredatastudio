/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileBrowserDataSource } from 'sql/workbench/services/fileBrowser/browser/fileBrowserDataSource';
import { FileBrowserController } from 'sql/workbench/services/fileBrowser/browser/fileBrowserController';
import { FileBrowserRenderer } from 'sql/workbench/services/fileBrowser/browser/fileBrowserRenderer';
import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import errors = require('vs/base/common/errors');
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import nls = require('vs/nls');
import { DefaultFilter, DefaultAccessibilityProvider, DefaultDragAndDrop } from 'vs/base/parts/tree/browser/treeDefaults';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITree } from 'vs/base/parts/tree/browser/tree';

/**
 * Implements tree view for file browser
 */
export class FileBrowserTreeView implements IDisposable {
	private _tree: ITree;
	private _toDispose: IDisposable[] = [];

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IFileBrowserService private _fileBrowserService: IFileBrowserService,
		@IThemeService private _themeService: IThemeService
	) {
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement, rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): void {
		if (!this._tree) {
			DOM.addClass(container, 'show-file-icons');
			this._tree = this.createFileBrowserTree(container, this._instantiationService);
			this._toDispose.push(this._tree.onDidChangeSelection((event) => this.onSelected(event)));
			this._toDispose.push(this._fileBrowserService.onExpandFolder(fileNode => this._tree.refresh(fileNode)));
			this._toDispose.push(attachListStyler(this._tree, this._themeService));
			this._tree.domFocus();
		}

		if (rootNode) {
			this._tree.setInput(rootNode).then(() => {
				if (expandedNodes) {
					this._tree.expandAll(expandedNodes);
				}
				if (selectedNode) {
					this._tree.select(selectedNode);
					this._tree.setFocus(selectedNode);
				}
				this._tree.getFocus();
			}, errors.onUnexpectedError);
		}
	}

	/**
	 * Create a file browser tree
	 */
	public createFileBrowserTree(treeContainer: HTMLElement, instantiationService: IInstantiationService): Tree {
		const dataSource = instantiationService.createInstance(FileBrowserDataSource);
		const renderer = instantiationService.createInstance(FileBrowserRenderer);
		const controller = instantiationService.createInstance(FileBrowserController);
		const dnd = new DefaultDragAndDrop();
		const filter = new DefaultFilter();
		const sorter = null;
		const accessibilityProvider = new DefaultAccessibilityProvider();

		return new Tree(treeContainer, {
			dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider
		}, {
				indentPixels: 10,
				twistiePixels: 12,
				ariaLabel: nls.localize({ key: 'fileBrowser.regTreeAriaLabel', comment: ['FileBrowserTree'] }, 'File browser tree')
			});
	}

	/**
	 * Refresh the tree
	 */
	public refreshTree(rootNode: FileNode): void {
		let selectedElement: any;
		let targetsToExpand: any[];

		// Focus
		this._tree.domFocus();

		if (this._tree) {
			let selection = this._tree.getSelection();
			if (selection && selection.length === 1) {
				selectedElement = <any>selection[0];
			}
			targetsToExpand = this._tree.getExpandedElements();
		}

		if (rootNode) {
			this._tree.setInput(rootNode).then(() => {
				// Make sure to expand all folders that were expanded in the previous session
				if (targetsToExpand) {
					this._tree.expandAll(targetsToExpand);
				}
				if (selectedElement) {
					this._tree.select(selectedElement);
					this._tree.setFocus(selectedElement);
				}
				this._tree.getFocus();
			}, errors.onUnexpectedError);
		}
	}

	private onSelected(event: any) {
		let selection = this._tree.getSelection();

		if (selection && selection.length > 0 && (selection[0] instanceof FileNode)) {
			let isMouseOrigin = event.payload && (event.payload.origin === 'mouse');
			let isSingleClick = isMouseOrigin && event.payload.originalEvent && event.payload.originalEvent.detail === 1;
			let isDoubleClick = isMouseOrigin && event.payload.originalEvent && event.payload.originalEvent.detail === 2;
			if (isSingleClick) {
				this.onClickedCallback(event.selection[0]);
			} else if (isDoubleClick) {
				this.onDoublieClickedCallback(event.selection[0]);
			}
		}
	}

	public onClickedCallback: any;
	public setOnClickedCallback(fn: any) {
		this.onClickedCallback = fn;
	}

	public onDoublieClickedCallback: any;
	public setOnDoubleClickedCallback(fn: any) {
		this.onDoublieClickedCallback = fn;
	}

	/**
	 * set the layout of the view
	 */
	public layout(height?: number): void {
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

	/**
	 * dispose the file browser tree view
	 */
	public dispose(): void {
		if (this._tree) {
			this._tree.dispose();
		}
		this._toDispose = dispose(this._toDispose);
	}
}