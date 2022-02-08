# Updating SQL Tools Service

This extension uses [SQL Tools Service](https://github.com/Microsoft/sqltoolsservice) to handle much of the direct interaction with the server, such as completions, language services and running queries.

To update the version of SQL Tools Service that this extension uses follow these steps :

1. Make your changes in the SQL Tools Service repo and get them merged in to main
2. Wait for the next release to be published. The publish pipeline runs daily and the releases will be published [here](https://github.com/microsoft/sqltoolsservice/releases)
3. Once the release is published and you've verified that it contains your changes then update [config.json](./config.json) and set the `version` field to the new version
   * Note that while usually updating the version alone is enough, sometimes you will need to update the file names as well (for example if the target framework changes). [Example PR](https://github.com/microsoft/azuredatastudio/pull/18056)
4. Open a PR with this change (or include it in a PR with other changes if you need to make changes in Azure Data Studio as well to utilize the new functionality)

**IMPORTANT** When updating the version make sure that if any other commits to SQL Tools Service are included you verify with the owners of those commits that it's OK to include them. Typically the best way to do this is to add them as a reviewer on the PR that you make. Getting their approval is required before merging in an update, failure to do so could break existing functionality.

Example PR : https://github.com/microsoft/azuredatastudio/pull/18205
