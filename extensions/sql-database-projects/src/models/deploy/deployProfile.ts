export interface IDeployProfile {
	serverName: string,
	port: number,
	userName: string,
	password: string,
	dbName: string,
	envVariableName?: string,
	connectionStringTemplate?: string,
	appSettingFile?: string;
}
