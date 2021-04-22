/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import { ModelViewBase } from './models/modelViewBase';
import { ViewBase } from './viewBase';


export interface iconSettings {
	width?: number,
	height?: number,
	containerWidth?: number,
	containerHeight?: number,
	css?: { [key: string]: string },
	path?: azdata.IconPath;
}
/**
 * View to pick model source
 */
export class DataInfoComponent extends ViewBase {
	private _labelContainer: azdata.FlexContainer | undefined;
	private _labelComponent: azdata.TextComponent | undefined;
	private _descriptionComponent: azdata.TextComponent | undefined;
	private _loadingComponent: azdata.LoadingComponent | undefined;
	private _width: number = 200;
	private _height: number = 200;
	private _title: string = '';
	private _description: string = '';
	private _iconComponent: azdata.ImageComponent | undefined;
	private _iconSettings: iconSettings | undefined;
	private _defaultIconSize = 128;


	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._descriptionComponent = modelBuilder.text().withProperties({
			value: this._description,
		}).component();
		this._labelComponent = modelBuilder.text().withProperties({
			value: this._title,
		}).component();
		this._labelContainer = modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: 'auto',
			height: this._height,
			justifyContent: 'center',
			alignItems: 'center',
			textAlign: 'center'
		}).component();

		if (!this._iconSettings) {
			this._iconSettings = {
				css: {},
				height: this._defaultIconSize,
				width: this._defaultIconSize,
				path: ''
				,
			};
		}

		this._iconComponent = modelBuilder.image().withProperties({
			width: this._iconSettings?.containerWidth ?? this._defaultIconSize,
			height: this._iconSettings?.containerHeight ?? this._defaultIconSize,
			iconWidth: this._iconSettings?.width ?? this._defaultIconSize,
			iconHeight: this._iconSettings?.height ?? this._defaultIconSize,
			title: this._title
		}).component();
		let iconContainer = modelBuilder.flexContainer().withLayout({
			width: this._iconSettings?.containerWidth ?? this._defaultIconSize,
		}).component();

		iconContainer.addItem(this._iconComponent, {
			CSSStyles: this._iconSettings?.css ?? {}
		});

		this._labelContainer.addItem(iconContainer);
		this._labelContainer.addItem(
			this._labelComponent
			, {
				CSSStyles: {
					'font-size': '16px'
				}
			});
		this._labelContainer.addItem(
			this._descriptionComponent
			, {
				CSSStyles: {
					'font-size': '13px'
				}
			});

		this._loadingComponent = modelBuilder.loadingComponent().withItem(
			this._labelContainer
		).withProperties({
			loading: false
		}).component();

		return this._loadingComponent;
	}

	public set width(value: number) {
		this._width = value;
	}

	public set height(value: number) {
		this._height = value;
	}

	public set title(value: string) {
		this._title = value;
	}

	public set description(value: string) {
		this._description = value;
	}

	public set iconSettings(value: iconSettings) {
		this._iconSettings = value;
	}

	public get iconSettings(): iconSettings {
		return this._iconSettings || {};
	}

	public get component(): azdata.Component | undefined {
		return this._loadingComponent;
	}

	public loading(): void {
		if (this._loadingComponent) {
			this._loadingComponent.loading = true;
		}
	}

	public loaded(): void {
		if (this._loadingComponent) {
			this._loadingComponent.loading = false;
		}
	}

	public async refresh(): Promise<void> {
		this.loaded();
		if (this._labelComponent) {
			this._labelComponent.value = this._title;
		}
		if (this._descriptionComponent) {
			this._descriptionComponent.value = this._description;
		}

		if (this._iconComponent) {
			this._iconComponent.iconPath = this._iconSettings?.path;
		}
		if (this._labelContainer) {
			this._labelContainer.height = this._height;
			this._labelContainer.width = this._width;
		}
		return Promise.resolve();
	}
}
