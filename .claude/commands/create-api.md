---
description: Scaffold a convention-compliant NestJS feature module from a plain-language API description
argument-hint: <describe the API, e.g. "CRUD for products with paginated list and status filter">
---

Invoke the `create-api` skill to scaffold a new feature module.

User's API description: $ARGUMENTS

Follow the skill exactly: parse the description, inspect the live DB via the
postgres MCP, run the adaptive interview (one question at a time, skipping
anything the description already answered), then generate the module and verify.
If the description is empty, start by asking what API to build.
