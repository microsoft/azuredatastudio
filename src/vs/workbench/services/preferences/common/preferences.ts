/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStringDictionary } from 'vs/base/common/collections';
import { Event } from 'vs/base/common/event';
import { IMatch } from 'vs/base/common/filters';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { URI } from 'vs/base/common/uri';
import { IRange } from 'vs/editor/common/core/range';
import { ITextModel } from 'vs/editor/common/model';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { ConfigurationScope, EditPresentationTypes, IConfigurationExtensionInfo } from 'vs/platform/configuration/common/configurationRegistry';
import { EditorResolution, IEditorOptions } from 'vs/platform/editor/common/editor';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ResolvedKeybindingItem } from 'vs/platform/keybinding/common/resolvedKeybindingItem';
import { IEditorInput, IEditorPane } from 'vs/workbench/common/editor';
import { Settings2EditorModel } from 'vs/workbench/services/preferences/common/preferencesModels';

export enum SettingValueType {
	Null = 'null',
	Enum = 'enum',
	String = 'string',
	MultilineString = 'multiline-string',
	Integer = 'integer',
	Number = 'number',
	Boolean = 'boolean',
	StringOrEnumArray = 'string-or-enum-array',
	Exclude = 'exclude',
	Complex = 'complex',
	NullableInteger = 'nullable-integer',
	NullableNumber = 'nullable-number',
	Object = 'object',
	BooleanObject = 'boolean-object'
}

export interface ISettingsGroup {
	id: string;
	range: IRange;
	title: string;
	titleRange: IRange;
	sections: ISettingsSection[];
	extensionInfo?: IConfigurationExtensionInfo;
}

export interface ISettingsSection {
	titleRange?: IRange;
	title?: string;
	settings: ISetting[];
}

export interface ISetting {
	range: IRange;
	key: string;
	keyRange: IRange;
	value: any;
	valueRange: IRange;
	description: string[];
	descriptionIsMarkdown?: boolean;
	descriptionRanges: IRange[];
	overrides?: ISetting[];
	overrideOf?: ISetting;
	deprecationMessage?: string;
	deprecationMessageIsMarkdown?: boolean;

	scope?: ConfigurationScope;
	type?: string | string[];
	arrayItemType?: string;
	objectProperties?: IJSONSchemaMap,
	objectPatternProperties?: IJSONSchemaMap,
	objectAdditionalProperties?: boolean | IJSONSchema,
	enum?: string[];
	enumDescriptions?: string[];
	enumDescriptionsAreMarkdown?: boolean;
	uniqueItems?: boolean;
	tags?: string[];
	disallowSyncIgnore?: boolean;
	restricted?: boolean;
	extensionInfo?: IConfigurationExtensionInfo;
	validator?: (value: any) => string | null;
	enumItemLabels?: string[];
	allKeysAreBoolean?: boolean;
	editPresentation?: EditPresentationTypes;
}

export interface IExtensionSetting extends ISetting {
	extensionName?: string;
	extensionPublisher?: string;
}

export interface ISearchResult {
	filterMatches: ISettingMatch[];
	exactMatch?: boolean;
	metadata?: IFilterMetadata;
}

export interface ISearchResultGroup {
	id: string;
	label: string;
	result: ISearchResult;
	order: number;
}

export interface IFilterResult {
	query?: string;
	filteredGroups: ISettingsGroup[];
	allGroups: ISettingsGroup[];
	matches: IRange[];
	metadata?: IStringDictionary<IFilterMetadata>;
	exactMatch?: boolean;
}

export interface ISettingMatch {
	setting: ISetting;
	matches: IRange[] | null;
	score: number;
}

export interface IScoredResults {
	[key: string]: IRemoteSetting;
}

export interface IRemoteSetting {
	score: number;
	key: string;
	id: string;
	defaultValue: string;
	description: string;
	packageId: string;
	extensionName?: string;
	extensionPublisher?: string;
}

export interface IFilterMetadata {
	requestUrl: string;
	requestBody: string;
	timestamp: number;
	duration: number;
	scoredResults: IScoredResults;

	/** The number of requests made, since requests are split by number of filters */
	requestCount?: number;

	/** The name of the server that actually served the request */
	context: string;
}

export interface IPreferencesEditorModel<T> {
	uri?: URI;
	getPreference(key: string): T | undefined;
	dispose(): void;
}

export type IGroupFilter = (group: ISettingsGroup) => boolean | null;
export type ISettingMatcher = (setting: ISetting, group: ISettingsGroup) => { matches: IRange[], score: number } | null;

export interface ISettingsEditorModel extends IPreferencesEditorModel<ISetting> {
	readonly onDidChangeGroups: Event<void>;
	settingsGroups: ISettingsGroup[];
	filterSettings(filter: string, groupFilter: IGroupFilter, settingMatcher: ISettingMatcher): ISettingMatch[];
	findValueMatches(filter: string, setting: ISetting): IRange[];
	updateResultGroup(id: string, resultGroup: ISearchResultGroup | undefined): IFilterResult | undefined;
}

export interface ISettingsEditorOptions extends IEditorOptions {
	target?: ConfigurationTarget;
	folderUri?: URI;
	query?: string;
	revealSetting?: {
		key: string;
		edit?: boolean;
	};
	focusSearch?: boolean;
}

export interface IOpenSettingsOptions extends ISettingsEditorOptions {
	jsonEditor?: boolean;
	openToSide?: boolean;
}

export function validateSettingsEditorOptions(options: ISettingsEditorOptions): ISettingsEditorOptions {
	return {
		// Inherit provided options
		...options,

		// Enforce some options for settings specifically
		override: EditorResolution.DISABLED,
		pinned: true
	};
}

export interface IKeybindingsEditorModel<T> extends IPreferencesEditorModel<T> {
}

export interface IKeybindingsEditorOptions extends IEditorOptions {
	query?: string;
}

export const IPreferencesService = createDecorator<IPreferencesService>('preferencesService');

export interface IPreferencesService {
	readonly _serviceBrand: undefined;

	userSettingsResource: URI;
	workspaceSettingsResource: URI | null;
	getFolderSettingsResource(resource: URI): URI | null;

	createPreferencesEditorModel(uri: URI): Promise<IPreferencesEditorModel<ISetting> | null>;
	resolveModel(uri: URI): ITextModel | null;
	createSettings2EditorModel(): Settings2EditorModel; // TODO

	openRawDefaultSettings(): Promise<IEditorPane | undefined>;
	openSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;
	openUserSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;
	openRemoteSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;
	openWorkspaceSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;
	openFolderSettings(options: IOpenSettingsOptions & { folderUri: IOpenSettingsOptions['folderUri'] }): Promise<IEditorPane | undefined>;
	openGlobalKeybindingSettings(textual: boolean, options?: IKeybindingsEditorOptions): Promise<void>;
	openDefaultKeybindingsFile(): Promise<IEditorPane | undefined>;
	getEditableSettingsURI(configurationTarget: ConfigurationTarget, resource?: URI): Promise<URI | null>;

	createSplitJsonEditorInput(configurationTarget: ConfigurationTarget, resource: URI): IEditorInput;
}

export interface KeybindingMatch {
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
	keyCode?: boolean;
}

export interface KeybindingMatches {
	firstPart: KeybindingMatch;
	chordPart: KeybindingMatch;
}

export interface IKeybindingItemEntry {
	id: string;
	templateId: string;
	keybindingItem: IKeybindingItem;
	commandIdMatches?: IMatch[];
	commandLabelMatches?: IMatch[];
	commandDefaultLabelMatches?: IMatch[];
	sourceMatches?: IMatch[];
	whenMatches?: IMatch[];
	keybindingMatches?: KeybindingMatches;
}

export interface IKeybindingItem {
	keybinding: ResolvedKeybinding;
	keybindingItem: ResolvedKeybindingItem;
	commandLabel: string;
	commandDefaultLabel: string;
	command: string;
	source: string;
	when: string;
}

export interface IKeybindingsEditorPane extends IEditorPane {

	readonly activeKeybindingEntry: IKeybindingItemEntry | null;
	readonly onDefineWhenExpression: Event<IKeybindingItemEntry>;
	readonly onLayout: Event<void>;

	search(filter: string): void;
	focusSearch(): void;
	clearSearchResults(): void;
	focusKeybindings(): void;
	recordSearchKeys(): void;
	toggleSortByPrecedence(): void;
	selectKeybinding(keybindingEntry: IKeybindingItemEntry): void;
	defineKeybinding(keybindingEntry: IKeybindingItemEntry, add: boolean): Promise<void>;
	defineWhenExpression(keybindingEntry: IKeybindingItemEntry): void;
	updateKeybinding(keybindingEntry: IKeybindingItemEntry, key: string, when: string | undefined): Promise<any>;
	removeKeybinding(keybindingEntry: IKeybindingItemEntry): Promise<any>;
	resetKeybinding(keybindingEntry: IKeybindingItemEntry): Promise<any>;
	copyKeybinding(keybindingEntry: IKeybindingItemEntry): Promise<void>;
	copyKeybindingCommand(keybindingEntry: IKeybindingItemEntry): Promise<void>;
	showSimilarKeybindings(keybindingEntry: IKeybindingItemEntry): void;
}

export const FOLDER_SETTINGS_PATH = '.azuredatastudio/settings.json'; // {{SQL CARBON EDIT}}
export const DEFAULT_SETTINGS_EDITOR_SETTING = 'workbench.settings.openDefaultSettings';
export const USE_SPLIT_JSON_SETTING = 'workbench.settings.useSplitJSON';
