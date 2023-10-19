/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDiffEditorBaseOptions, ValidDiffEditorBaseOptions } from 'vs/editor/common/config/editorOptions'; // {{SQL CARBON EDIT}} - Added IDiffEditorBaseOptions to import list

export const diffEditorDefaultOptions = ({ // {{SQL CARbon EDIT}} Added parens for cast below
	enableSplitViewResizing: true,
	splitViewDefaultRatio: 0.5,
	renderSideBySide: true,
	renderMarginRevertIcon: true,
	maxComputationTime: 5000,
	maxFileSize: 50,
	ignoreTrimWhitespace: true,
	renderIndicators: true,
	originalEditable: false,
	diffCodeLens: false,
	renderOverviewRuler: true,
	diffWordWrap: 'inherit',
	diffAlgorithm: 'advanced',
	accessibilityVerbose: false,
	experimental: {
		showMoves: false,
		showEmptyDecorations: true,
	},
	hideUnchangedRegions: {
		enabled: false,
		contextLineCount: 3,
		minimumLineCount: 3,
		revealLineCount: 20,
	},
	isInEmbeddedEditor: false,
	onlyShowAccessibleDiffViewer: false,
	renderSideBySideInlineBreakpoint: 900,
	useInlineViewWhenSpaceIsLimited: true,
} as Readonly<Required<IDiffEditorBaseOptions>>) satisfies ValidDiffEditorBaseOptions; // {{SQL CARBON EDIT}} Explicit cast to resolve type mismatch error with assignment
