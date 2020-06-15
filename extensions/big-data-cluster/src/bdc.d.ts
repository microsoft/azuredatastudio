declare module 'bdc' {

	export const enum constants {
		extensionName = 'Microsoft.big-data-cluster'
	}

	export interface IExtension {
		getClusterController(url: string, authType: AuthType, username?: string, password?: string): IClusterController;
	}

	export type AuthType = 'integrated' | 'basic';

	export interface IClusterController {
		getClusterConfig(): Promise<any>;
		getKnoxUsername(clusterUsername: string): Promise<string>;
	}
}
