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
	private pairs: KeyValue[] = [];

	constructor(private modelBuilder: azdata.ModelBuilder, pairs: KeyValue[]) {
		this.container = modelBuilder.divContainer().component();
		this.refresh(pairs);
	}

	// TODO: Support removing KeyValues, and handle race conditions when
	// adding/removing KeyValues concurrently. For now this should only be used
	// when the set of keys won't change (though their values can be refreshed).
	public refresh(pairs: KeyValue[]) {
		pairs.forEach(newPair => {
			const pair = this.pairs.find(oldPair => oldPair.key === newPair.key);
			if (pair) {
				pair.refresh(newPair.value);
			} else {
				this.pairs.push(newPair);
				this.container.addItem(
					newPair.getComponent(this.modelBuilder),
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

	/** Refreshes the value of the KeyValue pair */
	public abstract refresh(value: string): void;

	/** Returns a component representing the value of the KeyValue pair */
	protected abstract getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component;
}

/** Implementation of KeyValue where the value is text */
export class TextKeyValue extends KeyValue {
	private text?: azdata.TextComponent;

	public refresh(value: string) {
		if (this.text) {
			this.text.value = value;
		}
	}

	protected getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this.text = modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: this.value,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();
		return this.text;
	}
}

/** Implementation of KeyValue where the value is a readonly copyable input field */
export abstract class BaseInputKeyValue extends KeyValue {
	private input?: azdata.InputBoxComponent;

	constructor(key: string, value: string, private multiline: boolean) { super(key, value); }

	public refresh(value: string) {
		if (this.input) {
			this.input.value = value;
		}
	}

	protected getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		const container = modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		this.input = modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: this.value,
			readOnly: true,
			multiline: this.multiline
		}).component();
		container.addItem(this.input);

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
	private link?: azdata.HyperlinkComponent;

	constructor(key: string, value: string, private onClick: (e: any) => any) {
		super(key, value);
	}

	public refresh(value: string): void {
		if (this.link) {
			this.link.label = value;
		}
	}

	protected getValueComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this.link = modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: this.value, url: ''
		}).component();

		this.link.onDidClick(this.onClick);
		return this.link;
	}
}
