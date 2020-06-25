/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../constants';

/** A container with a single vertical column of KeyValue pairs */
export class KeyValueContainer {
	public container: azdata.DivContainer;
	private keyToComponent: Map<string, (azdata.TextComponent | azdata.InputBoxComponent)>;

	constructor(private modelBuilder: azdata.ModelBuilder, pairs: KeyValue[]) {
		this.container = modelBuilder.divContainer().component();
		this.keyToComponent = new Map<string, azdata.Component>();
		this.refresh(pairs);
	}

	// TODO: Support removing KeyValues, and handle race conditions when
	// adding/removing KeyValues concurrently. For now this should only be used
	// when the set of keys won't change (though their values can be refreshed).
	public refresh(pairs: KeyValue[]) {
		pairs.forEach(p => {
			let component = this.keyToComponent.get(p.key);
			if (component) {
				component.value = p.value;
			} else {
				component = p.getComponent(this.modelBuilder);
				this.keyToComponent.set(p.key, component);
				this.container.addItem(
					component,
					{ CSSStyles: { 'margin-bottom': '15px', 'min-height': '30px' } }
				);
			}
		});
	}
}

/** A key value pair in the KeyValueContainer */
export abstract class KeyValue {
	constructor(public key: string, public value: string) { }

	/** Returns a component representing the entire KeyValue pair */
	public getComponent(modelBuilder: azdata.ModelBuilder) {
		const container = modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap', alignItems: 'center' }).component();
		const key = modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: this.key,
			CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		container.addItem(key, { flex: `0 0 200px` });
		container.addItem(this.getValueComponent(modelBuilder), { flex: '1 1 250px' });
		return container;
	}

	/** Returns a component representing the value of the KeyValue pair */
	protected abstract getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component;
}

/** Implementation of KeyValue where the value is text */
export class TextKeyValue extends KeyValue {
	getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		return modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: this.value,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();
	}
}

/** Implementation of KeyValue where the value is a readonly copyable input field */
export abstract class BaseInputKeyValue extends KeyValue {
	constructor(key: string, value: string, private multiline: boolean) { super(key, value); }

	getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		const container = modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		container.addItem(modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: this.value,
			readOnly: true,
			multiline: this.multiline
		}).component());

		const copy = modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.copy, width: '17px', height: '17px'
		}).component();

		copy.onDidClick(async () => {
			vscode.env.clipboard.writeText(this.value);
			vscode.window.showInformationMessage(loc.copiedToClipboard(this.key));
		});

		container.addItem(copy, { CSSStyles: { 'margin-left': '10px' } });
		return container;
	}
}

/** Implementation of KeyValue where the value is a single line readonly copyable input field */
export class InputKeyValue extends BaseInputKeyValue {
	constructor(key: string, value: string) { super(key, value, false); }
}

/** Implementation of KeyValue where the value is a multi line readonly copyable input field */
export class MultilineInputKeyValue extends BaseInputKeyValue {
	constructor(key: string, value: string) { super(key, value, true); }
}

/** Implementation of KeyValue where the value is a clickable link */
export class LinkKeyValue extends KeyValue {
	constructor(key: string, value: string, private onClick: (e: any) => any) {
		super(key, value);
	}

	getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		const link = modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: this.value, url: ''
		}).component();

		link.onDidClick(this.onClick);
		return link;
	}
}
