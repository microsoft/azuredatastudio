/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileBrowserViewModel } from 'sql/workbench/services/fileBrowser/common/fileBrowserViewModel';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { FileBrowserTreeView } from 'sql/workbench/services/fileBrowser/browser/fileBrowserTreeView';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-fileBrowserTree',
	template: `
		<div #fileBrowserTree [ngStyle]="CSSStyles"></div>
	`
})
export default class FileBrowserTreeComponent extends ComponentBase<azdata.FileBrowserTreeProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _treeView: FileBrowserTreeView;
	private _viewModel: FileBrowserViewModel;
	private _fileFilters: [{ label: string, filters: string[] }] = [
		{ label: 'All Files', filters: ['*'] }
	];

	@ViewChild('fileBrowserTree', { read: ElementRef }) private _treeContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this._viewModel = this._instantiationService.createInstance(FileBrowserViewModel);
		this._viewModel.onAddFileTree(args => this.handleOnAddFileTree(args.rootNode, args.selectedNode, args.expandedNodes));
		this._viewModel.onPathValidate(args => this.handleOnValidate(args.succeeded, args.message));
		this.baseInit();
	}

	public initialize() {
		this._viewModel.initialize(this.ownerUri, '', this._fileFilters, 'Backup');
		this._treeView = this._instantiationService.createInstance(FileBrowserTreeView);
		this._treeView.setOnClickedCallback((arg) => {
			this.onClicked(arg);
		});
		this._treeView.setOnDoubleClickedCallback((arg) => this.onDoubleClicked(arg));
		this._register(this._treeView);
		this._viewModel.openFileBrowser(0, false);
	}

	private onClicked(selectedNode: FileNode) {
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: { fullPath: selectedNode.fullPath, isFile: selectedNode.isFile }
		});
	}

	private onDoubleClicked(selectedNode: FileNode) {
		if (selectedNode.isFile === true) {
		}
	}

	private async handleOnAddFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): Promise<void> {
		await this.updateFileTree(rootNode, selectedNode, expandedNodes);
	}

	private async updateFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): Promise<void> {
		await this._treeView.renderBody(this._treeContainer.nativeElement, rootNode, selectedNode, expandedNodes);
		this._treeView.setVisible(true);
		this.layoutTree();
		this._changeRef.detectChanges();
	}


	private handleOnValidate(succeeded: boolean, errorMessage: string) {
		if (succeeded === false) {
			if (errorMessage === '') {
				errorMessage = 'The provided path is invalid.';
			}
		}
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	private layoutTree(): void {
		this._treeView.layout(700);
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.ownerUri) {
			this.initialize();
		}
	}

	// CSS-bound properties
	public get ownerUri(): string {
		return this.getPropertyOrDefault<string>((props) => props.ownerUri, '');
	}

	public set ownerUri(newValue: string) {
		this.setPropertyFromUI<string>((props, value) => props.ownerUri = value, newValue);
	}

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth(),
			'height': this.getHeight()
		});
	}
}
