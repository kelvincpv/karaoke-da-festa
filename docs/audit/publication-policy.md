# GitHub publication policy

The user requests that GitHub stay current after each completed, validated delivery. Commit and push those deliveries without requesting routine confirmation again. This instruction continues to apply to future work in this repository.

- Coordinate the shared checkout with file owners before staging. Publish coherent changes with their dependencies; leave incomplete work unstaged.
- Inspect the branch, remote, index, and diff. Stage explicit paths; exclude secrets, environment files, local test output, and caches.
- Run the checks relevant to the exact staged delivery. When the shared checkout contains unrelated work, validate a separate checkout containing only the intended changes.
- Use descriptive commits and ordinary pushes, respect branch protections, and never force push. If the remote advances, resolve the integration with the owners and rerun relevant checks.
- Verify the resulting remote commit and record branch, full hash, commit link, executed checks, and concrete limitations in the task comment.
- GitHub publication does not imply production approval. Deployment, sensitive migrations, and incompatible architecture changes retain their existing approval requirements. Check connected deployment automation before pushing; use a delivery branch when main may auto-deploy.

Current quality workflow and tests are being integrated. Local mocked tests do not establish real Supabase/YouTube integration, production readiness, or measured capacity. The DevOps scalability audit records those limitations and historical evidence.
