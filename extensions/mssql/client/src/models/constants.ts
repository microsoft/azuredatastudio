/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionConstants } from 'extensions-modules/lib/models/contracts/contracts';
import { Runtime, LinuxDistribution } from 'extensions-modules/lib/models/platform';

// constants
export class Constants implements IExtensionConstants {
	public readonly languageId = 'sql';
	public readonly extensionName = 'mssql';
	public readonly extensionConfigSectionName = 'mssql';
	public readonly outputChannelName = 'MSSQL';
	public readonly providerId = 'MSSQL';
	public readonly installFolderName = 'sqltoolsservice';
	public readonly telemetryExtensionName = 'carbon-mssql';

	// localizable strings
	public readonly serviceCompatibleVersion = '1.0.0';
	public readonly serviceInstallingTo = 'Installing SQL tools service to';
	public readonly serviceInitializing = 'Initializing SQL tools service for the mssql extension.';
	public readonly commandsNotAvailableWhileInstallingTheService = 'Note: mssql commands will be available after installing the service.';
	public readonly serviceInstalled = 'Sql Tools Service installed';
	public readonly serviceInstallationFailed = 'Failed to install Sql Tools Service';
	public readonly serviceLoadingFailed = 'Failed to load Sql Tools Service';
	public readonly invalidServiceFilePath = 'Invalid file path for Sql Tools Service';
	public readonly serviceName = 'SQLToolsService';
	public readonly serviceInitializingOutputChannelName = 'SqlToolsService Initialization';
	public readonly serviceCrashMessage = 'SQL Tools Service component exited unexpectedly. Please restart SQL Operations Studio.';
	public readonly serviceCrashLink = 'https://github.com/Microsoft/vscode-mssql/wiki/SqlToolsService-Known-Issues';

	/**
	 * Returns a supported .NET Core Runtime ID (RID) for the current platform. The list of Runtime IDs
	 * is available at https://github.com/dotnet/corefx/tree/master/pkg/Microsoft.NETCore.Platforms.
	 */
	public getRuntimeId(platform: string, architecture: string, distribution: LinuxDistribution): Runtime {
		switch (platform) {
			case 'win32':
				switch (architecture) {
					case 'x86': return Runtime.Windows_86;
					case 'x86_64': return Runtime.Windows_64;
					default:
				}

				throw new Error(`Unsupported Windows architecture: ${architecture}`);

			case 'darwin':
				if (architecture === 'x86_64') {
					// Note: We return the El Capitan RID for Sierra
					return Runtime.OSX;
				}

				throw new Error(`Unsupported macOS architecture: ${architecture}`);

			case 'linux':
				if (architecture === 'x86_64') {

					// First try the distribution name
					let runtimeId = Constants.getRuntimeIdHelper(distribution.name, distribution.version);

					// If the distribution isn't one that we understand, but the 'ID_LIKE' field has something that we understand, use that
					//
					// NOTE: 'ID_LIKE' doesn't specify the version of the 'like' OS. So we will use the 'VERSION_ID' value. This will restrict
					// how useful ID_LIKE will be since it requires the version numbers to match up, but it is the best we can do.
					if (runtimeId === Runtime.UnknownRuntime && distribution.idLike && distribution.idLike.length > 0) {
						for (let id of distribution.idLike) {
							runtimeId = Constants.getRuntimeIdHelper(id, distribution.version);
							if (runtimeId !== Runtime.UnknownRuntime) {
								break;
							}
						}
					}

					if (runtimeId !== Runtime.UnknownRuntime && runtimeId !== Runtime.UnknownVersion) {
						return runtimeId;
					}
				}

				// If we got here, this is not a Linux distro or architecture that we currently support.
				throw new Error(`Unsupported Linux distro: ${distribution.name}, ${distribution.version}, ${architecture}`);
			default:
				// If we got here, we've ended up with a platform we don't support  like 'freebsd' or 'sunos'.
				// Chances are, VS Code doesn't support these platforms either.
				throw Error('Unsupported platform ' + platform);
		}
	}

	private static getRuntimeIdHelper(distributionName: string, distributionVersion: string): Runtime {
		switch (distributionName) {
			case 'ubuntu':
				if (distributionVersion.startsWith('14')) {
					// This also works for Linux Mint
					return Runtime.Ubuntu_14;
				} else if (distributionVersion.startsWith('16')) {
					return Runtime.Ubuntu_16;
				}

				break;
			case 'elementary':
			case 'elementary OS':
				if (distributionVersion.startsWith('0.3')) {
					// Elementary OS 0.3 Freya is binary compatible with Ubuntu 14.04
					return Runtime.Ubuntu_14;
				} else if (distributionVersion.startsWith('0.4')) {
					// Elementary OS 0.4 Loki is binary compatible with Ubuntu 16.04
					return Runtime.Ubuntu_16;
				}

				break;
			case 'linuxmint':
				if (distributionVersion.startsWith('18')) {
					// Linux Mint 18 is binary compatible with Ubuntu 16.04
					return Runtime.Ubuntu_16;
				}

				break;
			case 'centos':
			case 'ol':
				// Oracle Linux is binary compatible with CentOS
				return Runtime.CentOS_7;
			case 'fedora':
				return Runtime.Fedora_23;
			case 'opensuse':
				return Runtime.OpenSUSE_13_2;
			case 'sles':
				return Runtime.SLES_12_2;
			case 'rhel':
				return Runtime.RHEL_7;
			case 'debian':
				return Runtime.Debian_8;
			case 'galliumos':
				if (distributionVersion.startsWith('2.0')) {
					return Runtime.Ubuntu_16;
				}
				break;
			default:
				return Runtime.UnknownRuntime;
		}

		return Runtime.UnknownVersion;
	}
}