---
name: Extension management request
about: Submit a request for managing an extension in the Azure Data Studio gallery
title: ''
labels: ''
assignees: ''

---

<!-- This form is for extension publishers _only_.  If you are an extension _user_, your feedback and bugs need to be reported directly to the extension publisher. The 'Help > Report Issue' dialog can assist with this. -->

1. What is the extension ID/name?

    <!-- find `extensionName` in the [extension gallery JSON file](https://github.com/microsoft/azuredatastudio/blob/release/extensions/extensionsGallery.json) -->

2. Describe your management request.

    `[ Add extension | remove extension | update extension ]`

3. When would you like your extension management action to occur?

    `[ before | on | after ] <date>`

4. Where are your extension code and references located?

    Is your extension...

    * Built into or shipped with Azure Data Studio?
    * Code is checked into github.com/microsoft/azuredatastudio, but extension is installed separately?
    * Only in the gallery (you build the extension yourself)?
    * Any other locations or integration points referencing your extension?
