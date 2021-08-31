/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./insertCellsScreenshots';
import { Component, AfterViewInit, forwardRef, Inject, ComponentFactoryResolver, ViewContainerRef, ViewChild } from '@angular/core';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { IComponentEventArgs } from 'sql/platform/dashboard/browser/interfaces';
import CardComponent, { CardType } from 'sql/workbench/browser/modelComponents/card.component';
import { URI } from 'vs/base/common/uri';


export interface LayoutRequestParams {
	modelViewId?: string;
	alwaysRefresh?: boolean;
}

export interface Thumbnail {
	id: string,
	path: string,
	title: string
}

export interface InsertCellsComponentParams extends IBootstrapParams {
	thumbnails: Thumbnail[],
	onClick: (e: IComponentEventArgs) => void
}

@Component({
	selector: 'insert-cells-screenshots-component',
	template: '<div class="insert-cells-screenshot-grid"><ng-container #divContainer></ng-container></div>'
})
export class InsertCellsScreenshots implements AfterViewInit {
	@ViewChild('divContainer', { read: ViewContainerRef }) _containerRef: ViewContainerRef;

	constructor(
		@Inject(IBootstrapParams) private _params: InsertCellsComponentParams,
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver
	) { }

	ngAfterViewInit(): void {
		this._params.thumbnails.forEach((thumbnail: Thumbnail, idx: number) => {
			const cellImageUri = URI.parse(thumbnail.path);

			let cardComponentFactory = this._componentFactoryResolver.resolveComponentFactory(CardComponent);
			let cardComponent = this._containerRef.createComponent(cardComponentFactory);

			cardComponent.instance.setProperties({ iconPath: cellImageUri, label: thumbnail.title, value: thumbnail.id, cardType: CardType.Image });

			cardComponent.instance.enabled = true;
			cardComponent.instance.registerEventHandler(e => this._params.onClick(e));
		});
	}
}
