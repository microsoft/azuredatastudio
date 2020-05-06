/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { isNullOrUndefined } from 'util';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const DBProjectConfigurationKey: string = 'sqlDatabaseProjects';
export const NetCoreInstallLocationKey: string = 'netCoreSDKLocation';
export const NextCoreNonWindowsDefaultPath = '/usr/local/share';
export const NetCoreInstallationConfirmation: string = localize('sqlDatabaseProjects.NetCoreInstallationConfirmation', "The .NET Core SDK cannnot be located. Project build will not work. Please install the same or update the .Net Core SDK location in settings if already installed.");
export const UpdateNetCoreLocation: string = localize('sqlDatabaseProjects.UpdateNetCoreLocation', "Update .Net Core location");
export const InstallNetCore: string = localize('sqlDatabaseProjects.InstallNetCore', "Install .Net Core SDK");

export class NetCoreTool {

	public findOrInstallNetCore(): void {
		if (!this.isNetCoreInstallationPresent) {
			this.showInstallDialog();
		}
	}

	private showInstallDialog(): void {
		vscode.window.showInformationMessage(NetCoreInstallationConfirmation, UpdateNetCoreLocation, InstallNetCore).then(async (result) => {
			if (result === UpdateNetCoreLocation) {
				//open settings
				vscode.commands.executeCommand('workbench.action.openGlobalSettings');
			}
			else if (result === InstallNetCore) {
				//open install link
				const dotnetcoreURL = 'https://dotnet.microsoft.com/download/dotnet-core/3.1';
				vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
			}
		});
	}

	public get isNetCoreInstallationPresent(): Boolean {
		return (!isNullOrUndefined(this.netcoreInstallLocation) && fs.existsSync(this.netcoreInstallLocation));
	}

	public get netcoreInstallLocation(): string {
		return vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreInstallLocationKey] ||
			this.defaultLocalInstallLocationByDistribution;
	}

	private get defaultLocalInstallLocationByDistribution(): string | undefined {
		const osPlatform: string = os.platform();
		return (osPlatform === 'win32') ? this.defaultWindowsLocation :
			(osPlatform === 'darwin' || osPlatform === 'linux') ? this.defaultnonWindowsLocation :
				undefined;
	}

	private get defaultnonWindowsLocation(): string | undefined {
		const defaultNonWindowsInstallLocation = NextCoreNonWindowsDefaultPath; //default folder for net core sdk
		return this.getDotnetPathIfPresent(defaultNonWindowsInstallLocation) ||
			this.getDotnetPathIfPresent(os.homedir()) ||
			undefined;
	}

	private get defaultWindowsLocation(): string | undefined {
		return this.getDotnetPathIfPresent(process.env['ProgramW6432']) ||
			this.getDotnetPathIfPresent(process.env['ProgramFiles(x86)']) ||
			this.getDotnetPathIfPresent(process.env['ProgramFiles']);
	}

	private getDotnetPathIfPresent(folderPath: string | undefined): string | undefined {
		if (!isNullOrUndefined(folderPath) && fs.existsSync(path.join(folderPath, 'dotnet'))) {
			return path.join(folderPath, 'dotnet');
		}
		return undefined;
	}
}
