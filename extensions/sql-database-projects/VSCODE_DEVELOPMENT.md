# VS Code Extension Development

For working on the VS Code version of the package follow these steps for local development/testing.

1. Copy the values from [package.vscode.json](./package.vscode.json) into [package.json](./package.json) (overwriting the properties with the same name there)
2. Delete the following properties (this includes their arrays of values as well) from the `contributes/menus` property in the [package.json](./package.json)
   * `objectExplorer/item/context`
   * `dataExplorer/context`
   * `dashboard/toolbar`
3. Compile Azure Data Studio as normal and wait for it to finish
4. Run `code <PathToAzureDataStudioSource>/extensions/sql-database-projects` from the command line to open a new VS Code instance at the `sql-database-projects` folder
5. Run the `Launch Extension in VS Code` launch target from the `Run and Debug` view
6. This should launch an `Extension Development Host` version of VS Code that is running the extension from sources.

If you have the compilation running as watch then once you make changes you can just reload the window to pick up the latest changes being made.
