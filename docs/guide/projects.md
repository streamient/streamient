---
title: Streamient Projects Guide
description: "Organize Streamient notes, memories, URLs, and emails into isolated projects with separate knowledge, permissions, forwarding addresses, and integrations."
---

# Projects

Projects are organizational containers that group your notes, memories, and URLs together.

## Overview

Every account starts with a **Default** project. You can create additional projects to organize your knowledge by topic, client, area of work, or any other category.

All items (notes, memories, URLs) belong to exactly one project.

## Creating a Project

1. Click the **+** button in the project sidebar (left column)
2. Enter a name and pick a color
3. Click Create

The new project appears in the sidebar immediately.

## Switching Projects

Click any project in the sidebar to filter the current view to that project's items. The project selection applies across notes, memories, and URLs pages.

## Editing a Project

Click the edit icon next to a project name in the sidebar to update its name or color.

## Deleting a Project

Click the delete icon next to a project name. The **Default** project cannot be deleted.

::: warning
Only empty projects can be deleted. Move or trash active items and remove Git repositories and Obsidian connections first. Saves, moves, restores, and sync work must finish before deletion can proceed.
:::

If you later restore a trashed item whose project was deleted, Streamient restores it into the same account's active **Default** project. A restore cannot enter a project while that project is being deleted.

## Project Counts

The sidebar shows document counts (notes, memories, URLs) next to each project so you can see the size of each collection at a glance.

## AI Chat & Projects

The chat sidebar includes a project filter dropdown. Select a project to scope AI search results to that project only, or leave it on "All" to search across everything.

## MCP & API

Projects are available through both the REST API and the MCP server. When creating items via API or MCP, you can specify a `project_id`. If omitted, items are created in the default project.
