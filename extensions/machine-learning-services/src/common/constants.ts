/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const winPlatform = 'win32';
export const pythonBundleVersion = '0.0.1';
export const managePackagesCommand = 'jupyter.cmd.managePackages';
export const mlManagePackagesCommand = 'ml.command.managePackages';
export const extensionOutputChannel = 'Machine Learning Services';

// Localized texts
//
export const managePackageCommandError = localize('ml.managePackages.error', "Either no connection is available or the server does not have external script enabled.");
export const installDependenciesError = localize('ml.installDependencies.error', "Failed to install dependencies. Error:");
export const installDependenciesMsgTaskName = localize('ml.installDependencies.msgTaskName', "Installing Machine Learning extension dependencies");
export const installDependenciesPackages = localize('ml.installDependencies.packages', "Installing required packages ...");
export const installDependenciesPackagesAlreadyInstalled = localize('ml.installDependencies.packagesAlreadyInstalled', "Required packages are already installed.");
export const installDependenciesGetPackagesError = localize('ml.installDependencies.getPackagesError', "Failed to get installed python packages. Error:");
export const packageManagerNoConnection = localize('ml.packageManager.NoConnection', "No connection selected");
