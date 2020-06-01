# Updating the Swagger generated clients

The TypeScript clients used to communicate with the controller are generated from the controller's Swagger specification. To update the clients:

1. Get the Swagger specification from a running controller, and save it locally:
   * `https://<controller_ip>:30080/api/<api_name>/swagger.json`

2. Generate the clients:
   * At the time of writing, [editor.swagger.io](https://editor.swagger.io) does not support typescript-node client generation from OpenAPI 3.x specifications. So we'll use [openapi-generator.tech](https://openapi-generator.tech) instead.

   * Run openapi-generator:
	 * Either by [installing it](https://openapi-generator.tech/docs/installation) (requires Java) and running:
	   * `openapi-generator generate -i swagger.json -g typescript-node -o out --additional-properties supportsES6=true`

	 * Or by running the Docker image (works in Linux or PowerShell):
	   * `docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli generate -i /local/swagger.json -g typescript-node -o /local/out --additional-properties supportsES6=true`

3. Copy the generated clients (api.ts, api/, model/) to ./generated/<api_name>.

4. The generated clients have some unused imports. This will not compile.  VS Code has an "Organize Imports" command (Shift + Alt + O) that fixes this, but it fixes a single file. To organize imports for all files in a folder, you can use the [Folder Source Actions extension](https://marketplace.visualstudio.com/items?itemName=bierner.folder-source-actions). Followed by File -> Save All.
