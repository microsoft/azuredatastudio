/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { TreeComponentRenderer } from 'sql/parts/modelComponents/tree/treeComponentRenderer';
import { TreeComponentDataSource } from 'sql/parts/modelComponents/tree/treeDataSource';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { DefaultFilter, DefaultAccessibilityProvider, DefaultController } from 'vs/base/parts/tree/browser/treeDefaults';

@Component({
	selector: 'modelview-tree',
	template: `
		<div #input></div>
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
		@Inject(IContextViewService) private contextViewService: IContextViewService) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {

			this._tree = this.createTreeControl();
			let root: sqlops.TreeComponentDataModel = {
				data: '1',
				children: [
					{
						data:'11',
						id: '11'
					}, {
						data: '12',
						id: '12'
					}
				],
				id: '1'
			};

			this._tree.setInput(root);
			this._register(this._tree);
			this._register(this._tree.onDidExpandItem(e => {

			}));
		}
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	private createTreeControl(): Tree {
		const dataSource = new TreeComponentDataSource();
		const renderer = new TreeComponentRenderer(this.contextViewService, this.themeService);
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
		this._tree.layout(100, 100);
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel

		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);

	}

	// CSS-bound properties

	private get label(): string {
		return this.getPropertyOrDefault<sqlops.CheckBoxProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<sqlops.CheckBoxProperties, string>((properties, label) => { properties.label = label; }, newValue);
	}
}
