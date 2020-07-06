/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../constants';

/** A container with a single vertical column of KeyValue pairs */
export class KeyValueContainer extends vscode.Disposable {
	public container: azdata.DivContainer;
	private pairs: KeyValue[] = [];

	constructor(modelBuilder: azdata.ModelBuilder, pairs: KeyValue[]) {
		super(() => this.pairs.forEach(d => {
			try { d.dispose(); } catch { }
		}));

		this.container = modelBuilder.divContainer().component();
		this.refresh(pairs);
	}

	// TODO: Support adding/removing KeyValues concurrently. For now this should only
	// be used when the set of keys won't change (though their values can be refreshed).
	public refresh(pairs: KeyValue[]) {
		pairs.forEach(newPair => {
			const pair = this.pairs.find(oldPair => oldPair.key === newPair.key);
			if (!pair) {
				this.pairs.push(newPair);
				this.container.addItem(
					newPair.container,
					{ CSSStyles: { 'margin-bottom': '15px', 'min-height': '30px' } });
			} else if (pair.value !== newPair.value) {
				pair.setValue(newPair.value);
			}
		});
	}
}

/** A key value pair in the KeyValueContainer */
export abstract class KeyValue extends vscode.Disposable {
	readonly container: azdata.FlexContainer;
	protected disposables: vscode.Disposable[] = [];
	protected valueFlex = { flex: '1 1 250px' };
	private keyFlex = { flex: `0 0 200px` };

	constructor(modelBuilder: azdata.ModelBuilder, readonly key: string, private _value: string) {
		super(() => this.disposables.forEach(d => {
			try { d.dispose(); } catch { }
		}));

		this.container = modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const keyComponent = modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: key,
			CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		this.container.addItem(keyComponent, this.keyFlex);
	}

	get value(): string {
		return this._value;
	}

	public setValue(newValue: string) {
		this._value = newValue;
	}
}

/** Implementation of KeyValue where the value is text */
export class TextKeyValue extends KeyValue {
	private text: azdata.TextComponent;

	constructor(modelBuilder: azdata.ModelBuilder, key: string, value: string) {
		super(modelBuilder, key, value);

		this.text = modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: value,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		this.container.addItem(this.text, this.valueFlex);
	}

	public setValue(newValue: string) {
		super.setValue(newValue);
		this.text.value = newValue;
	}
}

/** Implementation of KeyValue where the value is a readonly copyable input field */
export abstract class BaseInputKeyValue extends KeyValue {
	private input: azdata.InputBoxComponent;

	constructor(modelBuilder: azdata.ModelBuilder, key: string, value: string, multiline: boolean) {
		super(modelBuilder, key, value);

		this.input = modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: value,
			readOnly: true,
			multiline: multiline
		}).component();

		const inputContainer = modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(this.input);

		const copy = modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.copy,
			width: '17px',
			height: '17px'
		}).component();

		this.disposables.push(copy.onDidClick(async () => {
			vscode.env.clipboard.writeText(value);
			vscode.window.showInformationMessage(loc.copiedToClipboard(key));
		}));

		inputContainer.addItem(copy, { CSSStyles: { 'margin-left': '10px' } });
		this.container.addItem(inputContainer, this.valueFlex);
	}

	public setValue(newValue: string) {
		super.setValue(newValue);
		this.input.value = newValue;
	}
}

/** Implementation of KeyValue where the value is a single line readonly copyable input field */
export class InputKeyValue extends BaseInputKeyValue {
	constructor(modelBuilder: azdata.ModelBuilder, key: string, value: string) {
		super(modelBuilder, key, value, false);
	}
}

/** Implementation of KeyValue where the value is a multi line readonly copyable input field */
export class MultilineInputKeyValue extends BaseInputKeyValue {
	constructor(modelBuilder: azdata.ModelBuilder, key: string, value: string) {
		super(modelBuilder, key, value, true);
	}
}

/** Implementation of KeyValue where the value is a clickable link */
export class LinkKeyValue extends KeyValue {
	private link: azdata.HyperlinkComponent;

	constructor(modelBuilder: azdata.ModelBuilder, key: string, value: string, onClick: (e: any) => any) {
		super(modelBuilder, key, value);

		this.link = modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: value,
			url: ''
		}).component();

		this.disposables.push(this.link.onDidClick(onClick));
		this.container.addItem(this.link, this.valueFlex);
	}

	public setValue(newValue: string) {
		super.setValue(newValue);
		this.link.label = newValue;
	}
}
