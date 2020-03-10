/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';

export const Resource: msRest.CompositeMapper = {
	serializedName: 'Resource',
	type: {
		name: 'Composite',
		className: 'Resource',
		modelProperties: {
			id: {
				readOnly: true,
				serializedName: 'id',
				type: {
					name: 'String'
				}
			},
			name: {
				readOnly: true,
				serializedName: 'name',
				type: {
					name: 'String'
				}
			},
			identity: {
				readOnly: true,
				serializedName: 'identity',
				type: {
					name: 'Composite',
					className: 'Identity'
				}
			},
			location: {
				serializedName: 'location',
				type: {
					name: 'String'
				}
			},
			type: {
				readOnly: true,
				serializedName: 'type',
				type: {
					name: 'String'
				}
			},
			tags: {
				serializedName: 'tags',
				type: {
					name: 'Dictionary',
					value: {
						type: {
							name: 'String'
						}
					}
				}
			}
		}
	}
};

export const ListWorkspaceModelsResult: msRest.CompositeMapper = {
	serializedName: 'ListWorkspaceModelsResult',
	type: {
		name: 'Composite',
		className: 'ListWorkspaceModelsResult',
		modelProperties: {
			value: {
				serializedName: '',
				type: {
					name: 'Sequence',
					element: {
						type: {
							name: 'Composite',
							className: 'WorkspaceModel'
						}
					}
				}
			},
			nextLink: {
				serializedName: 'nextLink',
				type: {
					name: 'String'
				}
			}
		}
	}
};

export const WorkspaceModel: msRest.CompositeMapper = {
	serializedName: 'WorkspaceModel',
	type: {
		name: 'Composite',
		className: 'WorkspaceModel',
		modelProperties: {
			...Resource.type.modelProperties,
			framework: {
				readOnly: true,
				serializedName: 'framework',
				type: {
					name: 'String'
				}
			},
		}
	}
};

export const MachineLearningServiceError: msRest.CompositeMapper = {
	serializedName: 'MachineLearningServiceError',
	type: {
		name: 'Composite',
		className: 'MachineLearningServiceError',
		modelProperties: {
			error: {
				readOnly: true,
				serializedName: 'error',
				type: {
					name: 'Composite',
					className: 'ErrorResponse'
				}
			}
		}
	}
};
export const ModelErrorResponse: msRest.CompositeMapper = {
	serializedName: 'ModelErrorResponse',
	type: {
		name: 'Composite',
		className: 'ModelErrorResponse',
		modelProperties: {
			code: {
				serializedName: 'code',
				type: {
					name: 'String'
				}
			},
			statusCode: {
				serializedName: 'statusCode',
				type: {
					name: 'Number'
				}
			},
			message: {
				serializedName: 'message',
				type: {
					name: 'String'
				}
			},
			details: {
				serializedName: 'details',
				type: {
					name: 'Sequence',
					element: {
						type: {
							name: 'Composite',
							className: 'ErrorDetails'
						}
					}
				}
			}
		}
	}
};
export const ArtifactDetails: msRest.CompositeMapper = {
	serializedName: 'ArtifactDetails',
	type: {
		name: 'Composite',
		className: 'ArtifactDetails',
		modelProperties: {
			id: {
				serializedName: 'id',
				type: {
					name: 'String'
				}
			},
			prefix: {
				serializedName: 'prefix',
				type: {
					name: 'String'
				}
			}
		}
	}
};
export const Asset: msRest.CompositeMapper = {
	serializedName: 'Asset',
	type: {
		name: 'Composite',
		className: 'Asset',
		modelProperties: {
			id: {
				serializedName: 'id',
				type: {
					name: 'String'
				}
			},
			name: {
				serializedName: 'name',
				type: {
					name: 'String'
				}
			},
			description: {
				serializedName: 'description',
				type: {
					name: 'String'
				}
			},
			artifacts: {
				serializedName: 'artifacts',
				type: {
					name: 'Sequence',
					element: {
						type: {
							name: 'Composite',
							className: 'ArtifactDetails'
						}
					}
				}
			},
			tags: {
				serializedName: 'tags',
				type: {
					name: 'Sequence',
					element: {
						type: {
							name: 'String'
						}
					}
				}
			},
			kvTags: {
				serializedName: 'kvTags',
				type: {
					name: 'Dictionary',
					value: {
						type: {
							name: 'String'
						}
					}
				}
			},
			properties: {
				serializedName: 'properties',
				type: {
					name: 'Dictionary',
					value: {
						type: {
							name: 'String'
						}
					}
				}
			},
			runid: {
				serializedName: 'runid',
				type: {
					name: 'String'
				}
			},
			projectid: {
				serializedName: 'projectid',
				type: {
					name: 'String'
				}
			},
			meta: {
				serializedName: 'meta',
				type: {
					name: 'Dictionary',
					value: {
						type: {
							name: 'String'
						}
					}
				}
			},
			createdTime: {
				serializedName: 'createdTime',
				type: {
					name: 'DateTime'
				}
			}
		}
	}
};
export const ArtifactContentInformationDto: msRest.CompositeMapper = {
	serializedName: 'ArtifactContentInformationDto',
	type: {
		name: 'Composite',
		className: 'ArtifactContentInformationDto',
		modelProperties: {
			contentUri: {
				serializedName: 'contentUri',
				type: {
					name: 'String'
				}
			},
			origin: {
				serializedName: 'origin',
				type: {
					name: 'String'
				}
			},
			container: {
				serializedName: 'container',
				type: {
					name: 'String'
				}
			},
			path: {
				serializedName: 'path',
				type: {
					name: 'String'
				}
			}
		}
	}
};
