/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/treeComponent';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { TreeComponentRenderer } from 'sql/workbench/browser/modelComponents/treeComponentRenderer';
import { TreeComponentDataSource } from 'sql/workbench/browser/modelComponents/treeDataSource';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { DefaultFilter, DefaultAccessibilityProvider, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITreeComponentItem } from 'sql/workbench/common/views';
import { TreeViewDataProvider } from 'sql/workbench/browser/modelComponents/treeViewDataProvider';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { values } from 'vs/base/common/collections';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IComponentDescriptor, IComponent, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { convertSizeToNumber } from 'sql/base/browser/dom';

class Root implements ITreeComponentItem {
	label = {
		label: 'root'
	};
	handle = '0';
	parentHandle = null;
	collapsibleState = 2;
	children = void 0;
	options = undefined;
}

@Component({
	selector: 'modelview-tree',
	template: `
		<div #input style="width: 100%;height:100%"></div>
	`
})
export default class TreeComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _tree: Tree;
	private _treeRenderer: TreeComponentRenderer;
	private _dataProvider: TreeViewDataProvider;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this.createTreeControl();
		}
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	public setDataProvider(handle: number, componentId: string, context: any): any {
		this._dataProvider = new TreeViewDataProvider(handle, componentId, context);
		this.createTreeControl();
	}

	public refreshDataProvider(itemsToRefreshByHandle: { [treeItemHandle: string]: ITreeComponentItem }): void {
		if (this._dataProvider) {
			this._dataProvider.getItemsToRefresh(itemsToRefreshByHandle);
		}

		if (this._tree) {
			for (const item of values(itemsToRefreshByHandle)) {
				this._tree.refresh(<ITreeComponentItem>item);
			}
		}
	}

	private createTreeControl(): void {
		if (!this._tree && this._dataProvider) {
			const dataSource = this._instantiationService.createInstance(TreeComponentDataSource, this._dataProvider);
			const renderer = new TreeComponentRenderer(this._dataProvider, this.themeService, { withCheckbox: this.withCheckbox });
			this._treeRenderer = renderer;
			const controller = new DefaultController();
			const filter = new DefaultFilter();
			const sorter = undefined;
			const dnd = undefined;
			const accessibilityProvider = new DefaultAccessibilityProvider();

			this._tree = new Tree(this._inputContainer.nativeElement,
				{ dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider },
				{
					indentPixels: 10,
					twistiePixels: 20,
					ariaLabel: 'Tree Node'
				});
			this._tree.setInput(new Root());
			this._tree.domFocus();
			this._register(this._tree);
			this._register(attachListStyler(this._tree, this.themeService));
			this._register(this._tree.onDidChangeSelection(e => {
				this._dataProvider.onNodeSelected(e.selection);
			}));
			this.onkeydown(this._inputContainer.nativeElement, (e: StandardKeyboardEvent) => {
				// Enter on a tree will select the currently selected item as the default behavior
				// but if not stopped here then will propagate up.
				// This might have unintended effects such as a dialog closing.
				if (e.keyCode === KeyCode.Enter) {
					this._tree.toggleExpansion(this._tree.getFocus());
					DOM.EventHelper.stop(e, true);
				}
			});
			this._tree.refresh();
			this.layout();
		}
	}

	/// IComponent implementation

	public layout(): void {
		if (this._tree) {
			this.layoutTree();
			this._tree.refresh();
		}
		super.layout();
	}

	private layoutTree(): void {
		let width: number = convertSizeToNumber(this.width);
		let height: number = convertSizeToNumber(this.height);
		this._tree.layout(
			height && height > 0 ? height : DOM.getContentHeight(this._inputContainer.nativeElement),
			width && width > 0 ? width : DOM.getContentWidth(this._inputContainer.nativeElement));
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel

		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._treeRenderer.options.withCheckbox = this.withCheckbox;
	}

	public get withCheckbox(): boolean {
		return this.getPropertyOrDefault<azdata.TreeProperties, boolean>((props) => props.withCheckbox, false);
	}

	public set withCheckbox(newValue: boolean) {
		this.setPropertyFromUI<azdata.TreeProperties, boolean>((properties, value) => { properties.withCheckbox = value; }, newValue);
	}
}
