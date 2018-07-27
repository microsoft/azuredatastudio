/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/parts/modelComponents/tree/treeComponent';
import 'vs/css!sql/media/icons/common-icons';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import { TreeNode } from 'sql/parts/modelComponents/tree/treeDataModel';
import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { TreeComponentRenderer } from 'sql/parts/modelComponents/tree/treeComponentRenderer';
import { TreeComponentDataSource } from 'sql/parts/modelComponents/tree/treeDataSource';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { DefaultFilter, DefaultAccessibilityProvider, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

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

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {

			this._tree = this.createTreeControl();
			this._tree.domFocus();
			this._register(this._tree);
			this._register(attachListStyler(this._tree, this.themeService));
		}
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	private createTreeControl(): Tree {
		const dataSource = this._instantiationService.createInstance(TreeComponentDataSource);
		const renderer = this._instantiationService.createInstance(TreeComponentRenderer);
		const controller = new DefaultController();
		const filter = new DefaultFilter();
		const sorter = undefined;
		const dnd = undefined;
		const accessibilityProvider = new DefaultAccessibilityProvider();

		return new Tree(this._inputContainer.nativeElement,
			{ dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider },
			{
				indentPixels: 10,
				twistiePixels: 20,
				ariaLabel: 'Tree Node'
			});
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
		this._tree.layout(700, 700);
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel

		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		let treeNode = TreeNode.createTree(this.data);
		this._tree.setInput(treeNode);
		this._register(treeNode.onTreeChange(node => {
			this._onEventEmitter.fire({
				eventType: ComponentEventType.onDidChange,
				args: node.data
			});
		}));
	}

	// CSS-bound properties

	private get data(): sqlops.TreeComponentDataModel {
		return this.getPropertyOrDefault<sqlops.TreeProperties, sqlops.TreeComponentDataModel>((props) => props.data, {});
	}

	private set data(newValue: sqlops.TreeComponentDataModel) {
		this.setPropertyFromUI<sqlops.TreeProperties, sqlops.TreeComponentDataModel>((properties, data) => { properties.data = data; }, newValue);
	}
}
