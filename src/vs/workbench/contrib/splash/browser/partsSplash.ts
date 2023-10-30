/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onDidChangeFullscreen, isFullscreen } from 'vs/base/browser/browser';
import * as dom from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';
import { Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { editorBackground, foreground } from 'vs/platform/theme/common/colorRegistry';
import { getThemeTypeSelector, IThemeService } from 'vs/platform/theme/common/themeService';
import { DEFAULT_EDITOR_MIN_DIMENSIONS } from 'vs/workbench/browser/parts/editor/editor';
import * as themes from 'vs/workbench/common/theme';
import { IWorkbenchLayoutService, Parts, Position } from 'vs/workbench/services/layout/browser/layoutService';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import * as perf from 'vs/base/common/performance';
import { assertIsDefined } from 'vs/base/common/types';
import { runWhenIdle } from 'vs/base/common/async';
import { ISplashStorageService } from 'vs/workbench/contrib/splash/browser/splash';

export class PartsSplash {

	private static readonly _splashElementId = 'monaco-parts-splash';

	private readonly _disposables = new DisposableStore();

	private _didChangeTitleBarStyle?: boolean;

	constructor(
		@IThemeService private readonly _themeService: IThemeService,
		@IWorkbenchLayoutService private readonly _layoutService: IWorkbenchLayoutService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@IEditorGroupsService editorGroupsService: IEditorGroupsService,
		@IConfigurationService private readonly _configService: IConfigurationService,
		@ISplashStorageService private readonly _partSplashService: ISplashStorageService
	) {
		Event.once(_layoutService.onDidLayout)(() => {
			this._removePartsSplash();
			perf.mark('code/didRemovePartsSplash');
		}, undefined, this._disposables);

		let lastIdleSchedule: IDisposable | undefined;
		Event.any(onDidChangeFullscreen, editorGroupsService.onDidLayout, _themeService.onDidColorThemeChange)(() => {
			lastIdleSchedule?.dispose();
			lastIdleSchedule = runWhenIdle(() => this._savePartsSplash(), 800);
		}, undefined, this._disposables);

		_configService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('window.titleBarStyle')) {
				this._didChangeTitleBarStyle = true;
				this._savePartsSplash();
			}
		}, this, this._disposables);
	}

	dispose(): void {
		this._disposables.dispose();
	}

	private _savePartsSplash() {
		const theme = this._themeService.getColorTheme();

		this._partSplashService.saveWindowSplash({
			zoomLevel: this._configService.getValue<undefined>('window.zoomLevel'),
			baseTheme: getThemeTypeSelector(theme.type),
			colorInfo: {
				foreground: theme.getColor(foreground)?.toString(),
				background: Color.Format.CSS.formatHex(theme.getColor(editorBackground) || themes.WORKBENCH_BACKGROUND(theme)),
				editorBackground: theme.getColor(editorBackground)?.toString(),
				titleBarBackground: theme.getColor(themes.TITLE_BAR_ACTIVE_BACKGROUND)?.toString(),
				activityBarBackground: theme.getColor(themes.ACTIVITY_BAR_BACKGROUND)?.toString(),
				sideBarBackground: theme.getColor(themes.SIDE_BAR_BACKGROUND)?.toString(),
				statusBarBackground: theme.getColor(themes.STATUS_BAR_BACKGROUND)?.toString(),
				statusBarNoFolderBackground: theme.getColor(themes.STATUS_BAR_NO_FOLDER_BACKGROUND)?.toString(),
				windowBorder: theme.getColor(themes.WINDOW_ACTIVE_BORDER)?.toString() ?? theme.getColor(themes.WINDOW_INACTIVE_BORDER)?.toString()
			},
			layoutInfo: !this._shouldSaveLayoutInfo() ? undefined : {
				sideBarSide: this._layoutService.getSideBarPosition() === Position.RIGHT ? 'right' : 'left',
				editorPartMinWidth: DEFAULT_EDITOR_MIN_DIMENSIONS.width,
				titleBarHeight: this._layoutService.isVisible(Parts.TITLEBAR_PART) ? dom.getTotalHeight(assertIsDefined(this._layoutService.getContainer(Parts.TITLEBAR_PART))) : 0,
				activityBarWidth: this._layoutService.isVisible(Parts.ACTIVITYBAR_PART) ? dom.getTotalWidth(assertIsDefined(this._layoutService.getContainer(Parts.ACTIVITYBAR_PART))) : 0,
				sideBarWidth: this._layoutService.isVisible(Parts.SIDEBAR_PART) ? dom.getTotalWidth(assertIsDefined(this._layoutService.getContainer(Parts.SIDEBAR_PART))) : 0,
				statusBarHeight: this._layoutService.isVisible(Parts.STATUSBAR_PART) ? dom.getTotalHeight(assertIsDefined(this._layoutService.getContainer(Parts.STATUSBAR_PART))) : 0,
				windowBorder: this._layoutService.hasWindowBorder(),
				windowBorderRadius: this._layoutService.getWindowBorderRadius()
			}
		});
	}

	private _shouldSaveLayoutInfo(): boolean {
		return !isFullscreen() && !this._environmentService.isExtensionDevelopment && !this._didChangeTitleBarStyle;
	}

	private _removePartsSplash(): void {
		const element = document.getElementById(PartsSplash._splashElementId);
		if (element) {
			element.style.display = 'none';
		}

		// remove initial colors
		const defaultStyles = document.head.getElementsByClassName('initialShellColors');
		if (defaultStyles.length) {
			document.head.removeChild(defaultStyles[0]);
		}
	}
}
