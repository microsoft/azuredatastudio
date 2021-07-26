import { IDeploySettings } from '../IDeploySettings';

export enum AppSettingType {
	None,
	AzureFunction
}
export interface IDeployProfile {
	localDbSetting?: ILocalDbSetting;
	deploySettings?: IDeploySettings;
	envVariableName?: string;
	appSettingFile?: string;
	appSettingType: AppSettingType;
}

export interface ILocalDbSetting {
	serverName: string,
	port: number,
	userName: string,
	password: string,
	dbName: string,
}
