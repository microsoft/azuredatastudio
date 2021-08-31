/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebookViewsCardTabs';
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookView } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookViewsCardTabComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCardTab.components';
import { LocalSelectionTransfer } from 'vs/workbench/browser/dnd';

@Component({
	selector: 'view-card-tabs-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsCardTabs.component.html'))
})
export class NotebookViewsCardTabsComponent extends AngularDisposable implements OnInit {
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() ready: boolean;
	@Input() cells: ICellModel[];
	@Input() tabTransfer: LocalSelectionTransfer<NotebookViewsCardTabComponent>;

	@ViewChild('templateRef') templateRef: TemplateRef<any>;
	@ViewChild('tabsContainer', { read: ElementRef }) private _tabsContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		//this.initialize();
	}

	ngAfterViewInit(): void {
		this.initialize();
	}

	public initialize(): void {
		/*
		// Drop support
		this._register(new DragAndDropObserver(this._tabsContainer.nativeElement, {
			onDragEnter: e => {

				// Always enable support to scroll while dragging
				this._tabsContainer.nativeElement.classList.add('scroll');
				console.log('onDragEnter');
			},

			onDragLeave: e => {
				console.log('onDragLeave');
				this._tabsContainer.nativeElement.classList.remove('scroll');
			},

			onDragEnd: e => {
				console.log('onDragEnd');
				this._tabsContainer.nativeElement.classList.remove('scroll');
			},

			onDrop: e => {
				console.log(e.target);
				this._tabsContainer.nativeElement.classList.remove('scroll');
			}
		}));
		*/
		this.detectChanges();
	}

	ngAfterContentInit() {
		this.detectChanges();
	}

	ngOnChanges() {
		this.detectChanges();
	}

	get elementRef(): ElementRef {
		return this._tabsContainer;
	}

	public detectChanges() {
		this._changeRef.detectChanges();
	}
}
