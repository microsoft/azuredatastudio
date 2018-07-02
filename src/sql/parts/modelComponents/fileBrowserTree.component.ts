/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { FileBrowserDataSource } from 'sql/parts/fileBrowser/fileBrowserDataSource';
import { FileBrowserRenderer } from 'sql/parts/fileBrowser/fileBrowserRenderer';
import { FileBrowserController } from 'sql/parts/fileBrowser/fileBrowserController';
import { DefaultDragAndDrop, DefaultFilter, DefaultAccessibilityProvider } from 'vs/base/parts/tree/browser/treeDefaults';
import { ITreeConfiguration, ITreeOptions } from 'vs/base/parts/tree/browser/tree';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { getContentHeight, getContentWidth } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IFileBrowserService } from '../fileBrowser/common/interfaces';
import { FileBrowserViewModel } from '../fileBrowser/fileBrowserViewModel';
import { FileNode } from 'sql/parts/fileBrowser/common/fileNode';
import { CommonServiceInterface } from '../../services/common/commonServiceInterface.service';
import { FileBrowserTreeView } from '../fileBrowser/fileBrowserTreeView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IErrorMessageService } from '../connection/common/connectionManagement';


@Component({
	selector: 'modelview-fileBrowserTree',
	template: `
		<div #fileBrowserTree style="width:420px;height:700px"></div>
	`
})
export default class FileBrowserTreeComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _treeView: FileBrowserTreeView;
	private _viewModel: FileBrowserViewModel;
	private _fileFilters: [{label: string, filters: string[]}] = [
		{ label: 'All Files', filters: ['*'] }
	];

	@ViewChild('fileBrowserTree', { read: ElementRef }) private _treeContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		this._viewModel = this._instantiationService.createInstance(FileBrowserViewModel);
		this._viewModel.onAddFileTree(args => this.handleOnAddFileTree(args.rootNode, args.selectedNode, args.expandedNodes));
		this._viewModel.onPathValidate(args => this.handleOnValidate(args.succeeded, args.message));
	}

	public initialize() {
		this._viewModel.initialize(this.ownerUri, '', this._fileFilters, 'Backup');
		this._treeView = this._instantiationService.createInstance(FileBrowserTreeView);
		this._treeView.setOnClickedCallback((arg) => this.onClicked(arg));
		this._treeView.setOnDoubleClickedCallback((arg) => this.onDoubleClicked(arg));
		this._viewModel.openFileBrowser(0, false);
	}

	private onClicked(selectedNode: FileNode) {
	}

	private onDoubleClicked(selectedNode: FileNode) {
		if (selectedNode.isFile === true) {
		}
	}

	private handleOnAddFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]) {
		this.updateFileTree(rootNode, selectedNode, expandedNodes);
	}

	private updateFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): void {
		this._treeView.renderBody(this._treeContainer.nativeElement, rootNode, selectedNode, expandedNodes);
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

	public validate(): Thenable<boolean> {
		return super.validate().then(valid => {
			// TODO: tree validation?
			return valid;
		});
	}

	ngOnDestroy(): void {
		this.baseDestroy();
		// this._treeView.dispose();
		// this._viewModel.closeFileBrowser();
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
	}

	public setLayout(): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	private layoutTree(): void {
		this._treeView.layout(700);
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.validate();
		if (this.ownerUri) {
			this.initialize();
		}
	}

	// CSS-bound properties
	public get ownerUri(): string {
		return this.getPropertyOrDefault<sqlops.FileBrowserTreeProperties, string>((props) => props.ownerUri, '');
	}

	public set ownerUri(newValue: string) {
		this.setPropertyFromUI<sqlops.FileBrowserTreeProperties, string>((props, value) => props.ownerUri = value, newValue);
	}
}
