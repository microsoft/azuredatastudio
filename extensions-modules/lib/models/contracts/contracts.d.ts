import { RequestType } from 'vscode-languageclient';
import { Runtime, LinuxDistribution } from '../platform';
export declare namespace VersionRequest {
    const type: RequestType<void, string, void, void>;
}
export declare type VersionResult = string;
export interface IExtensionConstants {
    extensionName: string;
    invalidServiceFilePath: string;
    serviceName: string;
    extensionConfigSectionName: string;
    serviceCompatibleVersion: string;
    outputChannelName: string;
    languageId: string;
    serviceInstallingTo: string;
    serviceInitializing: string;
    serviceInstalled: string;
    serviceLoadingFailed: string;
    serviceInstallationFailed: string;
    serviceInitializingOutputChannelName: string;
    commandsNotAvailableWhileInstallingTheService: string;
    providerId: string;
    serviceCrashMessage: string;
    serviceCrashLink: string;
    installFolderName: string;
    telemetryExtensionName: string;
    getRuntimeId(platform: string, architecture: string, distribution: LinuxDistribution): Runtime;
}
