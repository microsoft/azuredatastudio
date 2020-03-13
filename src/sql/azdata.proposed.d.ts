/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

import * as vscode from 'vscode';

declare module 'azdata' {
	/**
	 * Namespace for connection management
	 */
	export namespace connection {
		export type ConnectionEventType =
			| 'onConnect'
			| 'onDisconnect'
			| 'onConnectionChanged';

		export interface ConnectionEventListener {
			onConnectionEvent(type: ConnectionEventType, ownerUri: string, args: IConnectionProfile): void;
		}

		/**
		 * Register a connection event listener
		 */
		export function registerConnectionEventListener(listener: connection.ConnectionEventListener): void;

		export function getConnection(uri: string): Thenable<ConnectionProfile>;
	}

	export namespace nb {
		export interface NotebookDocument {
			/**
			 * Sets the trust mode for the notebook document.
			 */
			setTrusted(state: boolean);
		}
	}

	export type SqlDbType = 'BigInt' | 'Binary' | 'Bit' | 'Char' | 'DateTime' | 'Decimal'
		| 'Float' | 'Image' | 'Int' | 'Money' | 'NChar' | 'NText' | 'NVarChar' | 'Real'
		| 'UniqueIdentifier' | 'SmallDateTime' | 'SmallInt' | 'SmallMoney' | 'Text' | 'Timestamp'
		| 'TinyInt' | 'VarBinary' | 'VarChar' | 'Variant' | 'Xml' | 'Udt' | 'Structured' | 'Date'
		| 'Time' | 'DateTime2' | 'DateTimeOffset';

	export interface SimpleColumnInfo {
		name: string;
		/**
		 * This is expected to match the SqlDbTypes for serialization purposes
		 */
		dataTypeName: SqlDbType;
	}
	export interface SerializeDataStartRequestParams {
		/**
		 * 'csv', 'json', 'excel', 'xml'
		 */
		saveFormat: string;
		filePath: string;
		isLastBatch: boolean;
		rows: DbCellValue[][];
		columns: SimpleColumnInfo[];
		includeHeaders?: boolean;
		delimiter?: string;
		lineSeperator?: string;
		textIdentifier?: string;
		encoding?: string;
		formatted?: boolean;
	}

	export interface SerializeDataContinueRequestParams {
		filePath: string;
		isLastBatch: boolean;
		rows: DbCellValue[][];
	}

	export interface SerializeDataResult {
		messages?: string;
		succeeded: boolean;
	}

	export interface SerializationProvider extends DataProvider {
		startSerialization(requestParams: SerializeDataStartRequestParams): Thenable<SerializeDataResult>;
		continueSerialization(requestParams: SerializeDataContinueRequestParams): Thenable<SerializeDataResult>;
	}

	export namespace dataprotocol {
		export function registerSerializationProvider(provider: SerializationProvider): vscode.Disposable;
	}

	export interface HyperlinkComponent {
		/**
		 * An event called when the text is clicked
		 */
		onDidClick: vscode.Event<any>;
	}

	export interface DeclarativeTableColumn {
		headerCssStyles?: { [key: string]: string };
		rowCssStyles?: { [key: string]: string };
		ariaLabel?: string;
	}

	export enum DeclarativeDataType {
		component = 'component'
	}

	/*
	 * Add optional azureAccount for connectionWidget.
	 */
	export interface IConnectionProfile extends ConnectionInfo {
		azureAccount?: string;
	}

	/*
	 * Add optional per-OS default value.
	 */
	export interface DefaultValueOsOverride {
		os: string;

		defaultValueOverride: string;
	}

	export interface ConnectionOption {
		defaultValueOsOverrides?: DefaultValueOsOverride[];
	}

	/*
	 * Add OssRdbms for sqlops AzureResource.
	 */
	export enum AzureResource {
		OssRdbms = 2,
		AzureKeyVault = 3
	}

	export interface ModelBuilder {
		radioCardGroup(): ComponentBuilder<RadioCardGroupComponent>;
		separator(): ComponentBuilder<SeparatorComponent>;
	}

	export interface RadioCard {
		id: string;
		label: string;
		descriptions?: RadioCardDescription[];
		icon?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri };
	}

	export interface RadioCardDescription {
		ariaLabel: string;
		labelHeader: string;
		contents: RadioCardLabelValuePair[];
		valueHeader?: string;
	}

	export interface RadioCardLabelValuePair {
		label: string;
		value?: string;
	}

	export interface RadioCardGroupComponentProperties extends ComponentProperties, TitledComponentProperties {
		cards: RadioCard[];
		cardWidth: string;
		cardHeight: string;
		iconWidth?: string;
		iconHeight?: string;
		selectedCardId?: string;
	}

	export interface RadioCardGroupComponent extends Component, RadioCardGroupComponentProperties {
		onSelectionChanged: vscode.Event<any>;
	}

	export interface SeparatorComponent extends Component {
	}

	export interface DeclarativeTableProperties extends ComponentProperties {
	}

	export interface ComponentProperties {
		ariaHidden?: boolean;
	}

	export interface ComponentWithIconProperties {
		/**
		 * The path for the icon with optional dark-theme away alternative
		 */
		iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri };
		/**
		 * The height of the icon
		 */
		iconHeight?: number | string;
		/**
		 * The width of the icon
		 */
		iconWidth?: number | string;
		/**
		 * The title for the icon. This title will show when hovered over
		 */
		title?: string;
	}

	export interface ComponentWithIcon extends ComponentWithIconProperties {
	}

	export interface ImageComponent extends ComponentWithIcon {
	}

	export interface ImageComponentProperties extends ComponentProperties, ComponentWithIconProperties {
	}

	export interface InputBoxProperties extends ComponentProperties {
		validationErrorMessage?: string;
	}

	export interface CheckBoxProperties {
		required?: boolean;
	}

	export namespace nb {
		/**
		 * An event that is emitted when the active Notebook editor is changed.
		 */
		export const onDidChangeActiveNotebookEditor: vscode.Event<NotebookEditor>;
	}
}

