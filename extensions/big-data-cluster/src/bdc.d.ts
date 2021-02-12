declare module 'bdc' {

	export const enum constants {
		extensionName = 'Microsoft.big-data-cluster'
	}

	export interface IExtension {
		getClusterController(url: string, authType: AuthType, username?: string, password?: string): IClusterController;
	}

	export interface IEndpointModel {
		name?: string;
		description?: string;
		endpoint?: string;
		protocol?: string;
	}

	export interface IHttpResponse {
		method?: string;
		url?: string;
		statusCode?: number;
		statusMessage?: string;
	}

	export interface IEndPointsResponse {
		response: IHttpResponse;
		endPoints: IEndpointModel[];
	}

	export type AuthType = 'integrated' | 'basic';

	export interface IClusterController {
		getClusterConfig(): Promise<any>;
		getKnoxUsername(clusterUsername: string): Promise<string>;
		getEndPoints(promptConnect?: boolean): Promise<IEndPointsResponse>
	}
}
