import * as mssql from '../../../../mssql';

export interface UpdateDataModel {
	sourceEndpointInfo: mssql.SchemaCompareEndpointInfo;
	targetEndpointInfo: mssql.SchemaCompareEndpointInfo;
	action: UpdateAction;
}

export const enum UpdateAction {
	Compare = 0,
	Update = 1
}
