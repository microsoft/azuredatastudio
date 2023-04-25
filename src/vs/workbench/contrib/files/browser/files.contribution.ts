/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { sep } from 'vs/base/common/path';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationPropertySchema } from 'vs/platform/configuration/common/configurationRegistry';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IFileEditorInput, IEditorFactoryRegistry, EditorExtensions } from 'vs/workbench/common/editor';
import { AutoSaveConfiguration, HotExitConfiguration, FILES_EXCLUDE_CONFIG, FILES_ASSOCIATIONS_CONFIG } from 'vs/platform/files/common/files';
import { SortOrder, LexicographicOptions, FILE_EDITOR_INPUT_ID, BINARY_TEXT_FILE_MODE, UndoConfirmLevel, IFilesConfiguration } from 'vs/workbench/contrib/files/common/files';
import { TextFileEditorTracker } from 'vs/workbench/contrib/files/browser/editors/textFileEditorTracker';
import { TextFileSaveErrorHandler } from 'vs/workbench/contrib/files/browser/editors/textFileSaveErrorHandler';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { BinaryFileEditor } from 'vs/workbench/contrib/files/browser/editors/binaryFileEditor';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { isNative, isWeb, isWindows } from 'vs/base/common/platform';
import { ExplorerViewletViewsContribution } from 'vs/workbench/contrib/files/browser/explorerViewlet';
import { IEditorPaneRegistry, EditorPaneDescriptor } from 'vs/workbench/browser/editor';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ILabelService } from 'vs/platform/label/common/label';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ExplorerService, UNDO_REDO_SOURCE } from 'vs/workbench/contrib/files/browser/explorerService';
import { SUPPORTED_ENCODINGS } from 'vs/workbench/services/textfile/common/encoding';
import { Schemas } from 'vs/base/common/network';
import { WorkspaceWatcher } from 'vs/workbench/contrib/files/browser/workspaceWatcher';
import { editorConfigurationBaseNode } from 'vs/editor/common/config/editorConfigurationSchema';
import { DirtyFilesIndicator } from 'vs/workbench/contrib/files/common/dirtyFilesIndicator';
import { UndoCommand, RedoCommand } from 'vs/editor/browser/editorExtensions';
import { IUndoRedoService } from 'vs/platform/undoRedo/common/undoRedo';
import { IExplorerService } from 'vs/workbench/contrib/files/browser/files';
import * as locConstants from 'sql/base/common/locConstants'; // {{SQL CARBON EDIT}}
import { FileEditorInputSerializer, FileEditorWorkingCopyEditorHandler } from 'vs/workbench/contrib/files/browser/editors/fileEditorHandler';
import { ModesRegistry } from 'vs/editor/common/languages/modesRegistry';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

class FileUriLabelContribution implements IWorkbenchContribution {

	constructor(@ILabelService labelService: ILabelService) {
		labelService.registerFormatter({
			scheme: Schemas.file,
			formatting: {
				label: '${authority}${path}',
				separator: sep,
				tildify: !isWindows,
				normalizeDriveLetter: isWindows,
				authorityPrefix: sep + sep,
				workspaceSuffix: ''
			}
		});
	}
}

registerSingleton(IExplorerService, ExplorerService, true);

// Register file editors
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		BinaryFileEditor,
		BinaryFileEditor.ID,
		nls.localize('binaryFileEditor', "Binary File Editor")
	),
	[
		new SyncDescriptor(FileEditorInput)
	]
);

// Register default file input factory
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerFileEditorFactory({

	typeId: FILE_EDITOR_INPUT_ID,

	createFileEditor: (resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService): IFileEditorInput => {
		return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents);
	},

	isFileEditor: (obj): obj is IFileEditorInput => {
		return obj instanceof FileEditorInput;
	}
});

// Register Editor Input Serializer & Handler
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(FILE_EDITOR_INPUT_ID, FileEditorInputSerializer);
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(FileEditorWorkingCopyEditorHandler, LifecyclePhase.Ready);

// Register Explorer views
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ExplorerViewletViewsContribution, LifecyclePhase.Starting);

// Register Text File Editor Tracker
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(TextFileEditorTracker, LifecyclePhase.Starting);

// Register Text File Save Error Handler
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(TextFileSaveErrorHandler, LifecyclePhase.Starting);

// Register uri display for file uris
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(FileUriLabelContribution, LifecyclePhase.Starting);

// Register Workspace Watcher
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspaceWatcher, LifecyclePhase.Restored);

// Register Dirty Files Indicator
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(DirtyFilesIndicator, LifecyclePhase.Starting);

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

const hotExitConfiguration: IConfigurationPropertySchema = isNative ?
	{
		'type': 'string',
		'scope': ConfigurationScope.APPLICATION,
		'enum': [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
		'default': HotExitConfiguration.ON_EXIT,
		'markdownEnumDescriptions': [
			nls.localize('hotExit.off', 'Disable hot exit. A prompt will show when attempting to close a window with editors that have unsaved changes.'),
			nls.localize('hotExit.onExit', 'Hot exit will be triggered when the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu). All windows without folders opened will be restored upon next launch. A list of previously opened windows with unsaved files can be accessed via `File > Open Recent > More...`'),
			nls.localize('hotExit.onExitAndWindowClose', 'Hot exit will be triggered when the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu), and also for any window with a folder opened regardless of whether it\'s the last window. All windows without folders opened will be restored upon next launch. A list of previously opened windows with unsaved files can be accessed via `File > Open Recent > More...`')
		],
		'description': nls.localize('hotExit', "Controls whether unsaved files are remembered between sessions, allowing the save prompt when exiting the editor to be skipped.", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
	} : {
		'type': 'string',
		'scope': ConfigurationScope.APPLICATION,
		'enum': [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
		'default': HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE,
		'markdownEnumDescriptions': [
			nls.localize('hotExit.off', 'Disable hot exit. A prompt will show when attempting to close a window with editors that have unsaved changes.'),
			nls.localize('hotExit.onExitAndWindowCloseBrowser', 'Hot exit will be triggered when the browser quits or the window or tab is closed.')
		],
		'description': nls.localize('hotExit', "Controls whether unsaved files are remembered between sessions, allowing the save prompt when exiting the editor to be skipped.", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
	};

configurationRegistry.registerConfiguration({
	'id': 'files',
	'order': 9,
	'title': nls.localize('filesConfigurationTitle', "Files"),
	'type': 'object',
	'properties': {
		[FILES_EXCLUDE_CONFIG]: {
			'type': 'object',
			'markdownDescription': nls.localize('exclude', "Configure [glob patterns](https://code.visualstudio.com/docs/editor/codebasics#_advanced-search-options) for excluding files and folders. For example, the file explorer decides which files and folders to show or hide based on this setting. Refer to the `#search.exclude#` setting to define search-specific excludes."),
			'default': {
				...{ '**/.git': true, '**/.svn': true, '**/.hg': true, '**/CVS': true, '**/.DS_Store': true, '**/Thumbs.db': true },
				...(isWeb ? { '**/*.crswap': true /* filter out swap files used for local file access */ } : undefined)
			},
			'scope': ConfigurationScope.RESOURCE,
			'additionalProperties': {
				'anyOf': [
					{
						'type': 'boolean',
						'enum': [true, false],
						'enumDescriptions': [nls.localize('trueDescription', "Enable the pattern."), nls.localize('falseDescription', "Disable the pattern.")],
						'description': nls.localize('files.exclude.boolean', "The glob pattern to match file paths against. Set to true or false to enable or disable the pattern."),
					},
					{
						'type': 'object',
						'properties': {
							'when': {
								'type': 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								'pattern': '\\w*\\$\\(basename\\)\\w*',
								'default': '$(basename).ext',
								'markdownDescription': nls.localize({ key: 'files.exclude.when', comment: ['\\$(basename) should not be translated'] }, "Additional check on the siblings of a matching file. Use \\$(basename) as variable for the matching file name.")
							}
						}
					}
				]
			}
		},
		[FILES_ASSOCIATIONS_CONFIG]: {
			'type': 'object',
			'markdownDescription': nls.localize('associations', "Configure file associations to languages (e.g. `\"*.extension\": \"html\"`). These have precedence over the default associations of the languages installed."),
			'additionalProperties': {
				'type': 'string'
			}
		},
		'files.encoding': {
			'type': 'string',
			'enum': Object.keys(SUPPORTED_ENCODINGS),
			'default': 'utf8',
			'description': nls.localize('encoding', "The default character set encoding to use when reading and writing files. This setting can also be configured per language."),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
			'enumDescriptions': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong),
			'enumItemLabels': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong)
		},
		'files.autoGuessEncoding': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoGuessEncoding', "When enabled, the editor will attempt to guess the character set encoding when opening files. This setting can also be configured per language. Note, this setting is not respected by text search. Only {0} is respected.", '`#files.encoding#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.eol': {
			'type': 'string',
			'enum': [
				'\n',
				'\r\n',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('eol.LF', "LF"),
				nls.localize('eol.CRLF', "CRLF"),
				nls.localize('eol.auto', "Uses operating system specific end of line character.")
			],
			'default': 'auto',
			'description': nls.localize('eol', "The default end of line character."),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.enableTrash': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('useTrash', "Moves files/folders to the OS trash (recycle bin on Windows) when deleting. Disabling this will delete files/folders permanently.")
		},
		'files.trimTrailingWhitespace': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('trimTrailingWhitespace', "When enabled, will trim trailing whitespace when saving a file."),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.insertFinalNewline': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('insertFinalNewline', "When enabled, insert a final new line at the end of the file when saving it."),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.trimFinalNewlines': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('trimFinalNewlines', "When enabled, will trim all new lines after the final new line at the end of the file when saving it."),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
		'files.autoSave': {
			'type': 'string',
			'enum': [AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE],
			'markdownEnumDescriptions': [
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.off' }, "An editor with changes is never automatically saved."),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.afterDelay' }, "An editor with changes is automatically saved after the configured `#files.autoSaveDelay#`."),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.onFocusChange' }, "An editor with changes is automatically saved when the editor loses focus."),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.onWindowChange' }, "An editor with changes is automatically saved when the window loses focus.")
			],
			'default': isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF,
			'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSave' }, "Controls [auto save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) of editors that have unsaved changes.", AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE, AutoSaveConfiguration.AFTER_DELAY)
		},
		'files.autoSaveDelay': {
			'type': 'number',
			'default': 1000,
			'minimum': 0,
			'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSaveDelay' }, "Controls the delay in milliseconds after which an editor with unsaved changes is saved automatically. Only applies when `#files.autoSave#` is set to `{0}`.", AutoSaveConfiguration.AFTER_DELAY)
		},
		'files.watcherExclude': {
			'type': 'object',
			'default': { '**/.git/objects/**': true, '**/.git/subtree-cache/**': true, '**/node_modules/*/**': true, '**/.hg/store/**': true },
			'markdownDescription': locConstants.watcherExclude, // {{SQL CARBON EDIT}} Product name to ADS
			'scope': ConfigurationScope.RESOURCE
		},
		'files.watcherInclude': {
			'type': 'array',
			'items': {
				'type': 'string'
			},
			'default': [],
			'description': nls.localize('watcherInclude', "Configure extra paths to watch for changes inside the workspace. By default, all workspace folders will be watched recursively, except for folders that are symbolic links. You can explicitly add absolute or relative paths to support watching folders that are symbolic links. Relative paths will be resolved to an absolute path using the currently opened workspace."),
			'scope': ConfigurationScope.RESOURCE
		},
		'files.hotExit': hotExitConfiguration,
		'files.defaultLanguage': {
			'type': 'string',
			'markdownDescription': nls.localize('defaultLanguage', "The default language identifier that is assigned to new files. If configured to `${activeEditorLanguage}`, will use the language identifier of the currently active text editor if any.")
		},
		'files.maxMemoryForLargeFilesMB': {
			'type': 'number',
			'default': 4096,
			'minimum': 0,
			'markdownDescription': locConstants.filesContributionMaxMemoryForLargeFilesMB, // {{SQL CARBON EDIT}} Change product name to ADS
			included: isNative
		},
		'files.restoreUndoStack': {
			'type': 'boolean',
			'description': nls.localize('files.restoreUndoStack', "Restore the undo stack when a file is reopened."),
			'default': true
		},
		'files.saveConflictResolution': {
			'type': 'string',
			'enum': [
				'askUser',
				'overwriteFileOnDisk'
			],
			'enumDescriptions': [
				nls.localize('askUser', "Will refuse to save and ask for resolving the save conflict manually."),
				nls.localize('overwriteFileOnDisk', "Will resolve the save conflict by overwriting the file on disk with the changes in the editor.")
			],
			'description': nls.localize('files.saveConflictResolution', "A save conflict can occur when a file is saved to disk that was changed by another program in the meantime. To prevent data loss, the user is asked to compare the changes in the editor with the version on disk. This setting should only be changed if you frequently encounter save conflict errors and may result in data loss if used without caution."),
			'default': 'askUser',
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.simpleDialog.enable': {
			'type': 'boolean',
			'description': nls.localize('files.simpleDialog.enable', "Enables the simple file dialog. The simple file dialog replaces the system file dialog when enabled."),
			'default': false
		},
		'files.participants.timeout': {
			type: 'number',
			default: 60000,
			markdownDescription: nls.localize('files.participants.timeout', "Timeout in milliseconds after which file participants for create, rename, and delete are cancelled. Use `0` to disable participants."),
		}
	}
});

configurationRegistry.registerConfiguration({
	...editorConfigurationBaseNode,
	properties: {
		'editor.formatOnSave': {
			'type': 'boolean',
			'description': nls.localize('formatOnSave', "Format a file on save. A formatter must be available, the file must not be saved after delay, and the editor must not be shutting down."),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
		'editor.formatOnSaveMode': {
			'type': 'string',
			'default': 'file',
			'enum': [
				'file',
				'modifications',
				'modificationsIfAvailable'
			],
			'enumDescriptions': [
				nls.localize({ key: 'everything', comment: ['This is the description of an option'] }, "Format the whole file."),
				nls.localize({ key: 'modification', comment: ['This is the description of an option'] }, "Format modifications (requires source control)."),
				nls.localize({ key: 'modificationIfAvailable', comment: ['This is the description of an option'] }, "Will attempt to format modifications only (requires source control). If source control can't be used, then the whole file will be formatted."),
			],
			'markdownDescription': nls.localize('formatOnSaveMode', "Controls if format on save formats the whole file or only modifications. Only applies when `#editor.formatOnSave#` is enabled."),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
	}
});

configurationRegistry.registerConfiguration({
	'id': 'explorer',
	'order': 10,
	'title': nls.localize('explorerConfigurationTitle', "File Explorer"),
	'type': 'object',
	'properties': {
		'explorer.openEditors.visible': {
			'type': 'number',
			'description': nls.localize({ key: 'openEditorsVisible', comment: ['Open is an adjective'] }, "The maximum number of editors shown in the Open Editors pane. Setting this to 0 hides the Open Editors pane."),
			'default': 9,
			'minimum': 0
		},
		'explorer.openEditors.minVisible': {
			'type': 'number',
			'description': nls.localize({ key: 'openEditorsVisibleMin', comment: ['Open is an adjective'] }, "The minimum number of editor slots shown in the Open Editors pane. If set to 0 the Open Editors pane will dynamically resize based on the number of editors."),
			'default': 0,
			'minimum': 0
		},
		'explorer.openEditors.sortOrder': {
			'type': 'string',
			'enum': ['editorOrder', 'alphabetical', 'fullPath'],
			'description': nls.localize({ key: 'openEditorsSortOrder', comment: ['Open is an adjective'] }, "Controls the sorting order of editors in the Open Editors pane."),
			'enumDescriptions': [
				nls.localize('sortOrder.editorOrder', 'Editors are ordered in the same order editor tabs are shown.'),
				nls.localize('sortOrder.alphabetical', 'Editors are ordered alphabetically by tab name inside each editor group.'),
				nls.localize('sortOrder.fullPath', 'Editors are ordered alphabetically by full path inside each editor group.')
			],
			'default': 'editorOrder'
		},
		'explorer.autoReveal': {
			'type': ['boolean', 'string'],
			'enum': [true, false, 'focusNoScroll'],
			'default': true,
			'enumDescriptions': [
				nls.localize('autoReveal.on', 'Files will be revealed and selected.'),
				nls.localize('autoReveal.off', 'Files will not be revealed and selected.'),
				nls.localize('autoReveal.focusNoScroll', 'Files will not be scrolled into view, but will still be focused.'),
			],
			'description': nls.localize('autoReveal', "Controls whether the explorer should automatically reveal and select files when opening them.")
		},
		'explorer.enableDragAndDrop': {
			'type': 'boolean',
			'description': nls.localize('enableDragAndDrop', "Controls whether the explorer should allow to move files and folders via drag and drop. This setting only effects drag and drop from inside the explorer."),
			'default': true
		},
		'explorer.confirmDragAndDrop': {
			'type': 'boolean',
			'description': nls.localize('confirmDragAndDrop', "Controls whether the explorer should ask for confirmation to move files and folders via drag and drop."),
			'default': true
		},
		'explorer.confirmDelete': {
			'type': 'boolean',
			'description': nls.localize('confirmDelete', "Controls whether the explorer should ask for confirmation when deleting a file via the trash."),
			'default': true
		},
		'explorer.enableUndo': {
			'type': 'boolean',
			'description': nls.localize('enableUndo', "Controls whether the explorer should support undoing file and folder operations."),
			'default': true
		},
		'explorer.confirmUndo': {
			'type': 'string',
			'enum': [UndoConfirmLevel.Verbose, UndoConfirmLevel.Default, UndoConfirmLevel.Light],
			'description': nls.localize('confirmUndo', "Controls whether the explorer should ask for confirmation when undoing."),
			'default': UndoConfirmLevel.Default,
			'enumDescriptions': [
				nls.localize('enableUndo.verbose', 'Explorer will prompt before all undo operations.'),
				nls.localize('enableUndo.default', 'Explorer will prompt before destructive undo operations.'),
				nls.localize('enableUndo.light', 'Explorer will not prompt before undo operations when focused.'),
			],
		},
		'explorer.expandSingleFolderWorkspaces': {
			'type': 'boolean',
			'description': nls.localize('expandSingleFolderWorkspaces', "Controls whether the explorer should expand multi-root workspaces containing only one folder during initialization"),
			'default': true
		},
		'explorer.sortOrder': {
			'type': 'string',
			'enum': [SortOrder.Default, SortOrder.Mixed, SortOrder.FilesFirst, SortOrder.Type, SortOrder.Modified, SortOrder.FoldersNestsFiles],
			'default': SortOrder.Default,
			'enumDescriptions': [
				nls.localize('sortOrder.default', 'Files and folders are sorted by their names. Folders are displayed before files.'),
				nls.localize('sortOrder.mixed', 'Files and folders are sorted by their names. Files are interwoven with folders.'),
				nls.localize('sortOrder.filesFirst', 'Files and folders are sorted by their names. Files are displayed before folders.'),
				nls.localize('sortOrder.type', 'Files and folders are grouped by extension type then sorted by their names. Folders are displayed before files.'),
				nls.localize('sortOrder.modified', 'Files and folders are sorted by last modified date in descending order. Folders are displayed before  files.'),
				nls.localize('sortOrder.foldersNestsFiles', 'Files and folders are sorted by their names. Folders are displayed before files. Files with nested children are displayed before other files.')
			],
			'markdownDescription': nls.localize('sortOrder', "Controls the property-based sorting of files and folders in the explorer. When `#explorer.fileNesting.enabled#` is enabled, also controls sorting of nested files.")
		},
		'explorer.sortOrderLexicographicOptions': {
			'type': 'string',
			'enum': [LexicographicOptions.Default, LexicographicOptions.Upper, LexicographicOptions.Lower, LexicographicOptions.Unicode],
			'default': LexicographicOptions.Default,
			'enumDescriptions': [
				nls.localize('sortOrderLexicographicOptions.default', 'Uppercase and lowercase names are mixed together.'),
				nls.localize('sortOrderLexicographicOptions.upper', 'Uppercase names are grouped together before lowercase names.'),
				nls.localize('sortOrderLexicographicOptions.lower', 'Lowercase names are grouped together before uppercase names.'),
				nls.localize('sortOrderLexicographicOptions.unicode', 'Names are sorted in unicode order.')
			],
			'description': nls.localize('sortOrderLexicographicOptions', "Controls the lexicographic sorting of file and folder names in the Explorer.")
		},
		'explorer.decorations.colors': {
			type: 'boolean',
			description: nls.localize('explorer.decorations.colors', "Controls whether file decorations should use colors."),
			default: true
		},
		'explorer.decorations.badges': {
			type: 'boolean',
			description: nls.localize('explorer.decorations.badges', "Controls whether file decorations should use badges."),
			default: true
		},
		'explorer.incrementalNaming': {
			'type': 'string',
			enum: ['simple', 'smart'],
			enumDescriptions: [
				nls.localize('simple', "Appends the word \"copy\" at the end of the duplicated name potentially followed by a number"),
				nls.localize('smart', "Adds a number at the end of the duplicated name. If some number is already part of the name, tries to increase that number")
			],
			description: nls.localize('explorer.incrementalNaming', "Controls what naming strategy to use when a giving a new name to a duplicated explorer item on paste."),
			default: 'simple'
		},
		'explorer.compactFolders': {
			'type': 'boolean',
			'description': nls.localize('compressSingleChildFolders', "Controls whether the explorer should render folders in a compact form. In such a form, single child folders will be compressed in a combined tree element. Useful for Java package structures, for example."),
			'default': true
		},
		'explorer.copyRelativePathSeparator': {
			'type': 'string',
			'enum': [
				'/',
				'\\',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('copyRelativePathSeparator.slash', "Use slash as path separation character."),
				nls.localize('copyRelativePathSeparator.backslash', "Use backslash as path separation character."),
				nls.localize('copyRelativePathSeparator.auto', "Uses operating system specific path separation character."),
			],
			'description': nls.localize('copyRelativePathSeparator', "The path separation character used when copying relative file paths."),
			'default': 'auto'
		},
		'explorer.excludeGitIgnore': {
			type: 'boolean',
			markdownDescription: nls.localize('excludeGitignore', "Controls whether entries in .gitignore should be parsed and excluded from the explorer. Similar to {0}.", '`#files.exclude#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'explorer.fileNesting.enabled': {
			'type': 'boolean',
			scope: ConfigurationScope.RESOURCE,
			'markdownDescription': nls.localize('fileNestingEnabled', "Controls whether file nesting is enabled in the explorer. File nesting allows for related files in a directory to be visually grouped together under a single parent file."),
			'default': false,
		},
		'explorer.fileNesting.expand': {
			'type': 'boolean',
			'markdownDescription': nls.localize('fileNestingExpand', "Controls whether file nests are automatically expanded. {0} must be set for this to take effect.", '`#explorer.fileNesting.enabled#`'),
			'default': true,
		},
		'explorer.fileNesting.patterns': {
			'type': 'object',
			scope: ConfigurationScope.RESOURCE,
			'markdownDescription': nls.localize('fileNestingPatterns', "Controls nesting of files in the explorer. Each __Item__ represents a parent pattern and may contain a single `*` character that matches any string. Each __Value__ represents a comma separated list of the child patterns that should be shown nested under a given parent. Child patterns may contain several special tokens:\n- `${capture}`: Matches the resolved value of the `*` from the parent pattern\n- `${basename}`: Matches the parent file's basename, the `file` in `file.ts`\n- `${extname}`: Matches the parent file's extension, the `ts` in `file.ts`\n- `${dirname}`: Matches the parent file's directory name, the `src` in `src/file.ts`\n- `*`:  Matches any string, may only be used once per child pattern"),
			patternProperties: {
				'^[^*]*\\*?[^*]*$': {
					markdownDescription: nls.localize('fileNesting.description', "Each key pattern may contain a single `*` character which will match any string."),
					type: 'string',
					pattern: '^([^,*]*\\*?[^,*]*)(, ?[^,*]*\\*?[^,*]*)*$',
				}
			},
			additionalProperties: false,
			'default': {
				'*.ts': '${capture}.js',
				'*.js': '${capture}.js.map, ${capture}.min.js, ${capture}.d.ts',
				'*.jsx': '${capture}.js',
				'*.tsx': '${capture}.ts',
				'tsconfig.json': 'tsconfig.*.json',
				'package.json': 'package-lock.json, yarn.lock, pnpm-lock.yaml',
			}
		}
	}
});

UndoCommand.addImplementation(110, 'explorer', (accessor: ServicesAccessor) => {
	const undoRedoService = accessor.get(IUndoRedoService);
	const explorerService = accessor.get(IExplorerService);
	const configurationService = accessor.get(IConfigurationService);

	const explorerCanUndo = configurationService.getValue<IFilesConfiguration>().explorer.enableUndo;
	if (explorerService.hasViewFocus() && undoRedoService.canUndo(UNDO_REDO_SOURCE) && explorerCanUndo) {
		undoRedoService.undo(UNDO_REDO_SOURCE);
		return true;
	}

	return false;
});

RedoCommand.addImplementation(110, 'explorer', (accessor: ServicesAccessor) => {
	const undoRedoService = accessor.get(IUndoRedoService);
	const explorerService = accessor.get(IExplorerService);
	const configurationService = accessor.get(IConfigurationService);

	const explorerCanUndo = configurationService.getValue<IFilesConfiguration>().explorer.enableUndo;
	if (explorerService.hasViewFocus() && undoRedoService.canRedo(UNDO_REDO_SOURCE) && explorerCanUndo) {
		undoRedoService.redo(UNDO_REDO_SOURCE);
		return true;
	}

	return false;
});

ModesRegistry.registerLanguage({
	id: BINARY_TEXT_FILE_MODE,
	aliases: ['Binary'],
	mimetypes: ['text/x-code-binary']
});
