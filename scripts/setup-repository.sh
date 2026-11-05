#!/usr/bin/env bash
# Applies this repository's GitHub settings, each step announcing itself, then
# fails while a secret the workflows need is missing, saying how to create it.
# Each step sets the desired state, so reruns are safe.
#
# Run it from a clone whose GitHub remote is the repository, with `gh` logged in
# as an admin. The admin watches the run, so no `gh` call needs a deadline of
# its own: interrupt a stalled one, and rerun.
set -euo pipefail
cd "$(dirname "$0")/.."

repository=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
description=$(node --print 'require("./package.json").description')
homepage=$(node --print 'require("./packages/site/package.json").homepage')

echo "Setting the description and homepage of $repository, and allowing auto-merge"
# Renovate merges each update through GitHub's auto-merge.
gh api --method PATCH "repos/$repository" \
  --raw-field description="$description" \
  --raw-field homepage="$homepage" \
  --field allow_auto_merge=true \
  --silent

echo "Building GitHub Pages from a workflow"
# POST creates Pages, and PUT updates it once it exists.
has_pages=$(gh api "repos/$repository" --jq .has_pages)
if [[ $has_pages == true ]]; then
  pages_method=PUT
else
  pages_method=POST
fi
gh api --method "$pages_method" "repos/$repository/pages" --raw-field build_type=workflow --silent

echo "Protecting main from deletion, force pushes and merges that fail a check"
# Every job of check.yml is a required check, which only GitHub Actions may
# report; they gate each pull request, Renovate's auto-merged ones included.
github_actions_app_id=$(gh api apps/github-actions --jq .id)
# Bun reads the workflow's YAML, which Node cannot without a package:
# https://bun.com/docs/runtime/yaml
required_checks=$(bun --print "JSON.stringify(
  Object.values(Bun.YAML.parse(await Bun.file('.github/workflows/check.yml').text()).jobs)
    .map(({ name }) => ({ context: name, integration_id: $github_actions_app_id }))
)")
# Repository admins, role 5, may push to main directly, since the deploy
# workflow checks each push. A pull request need not be up to date with main,
# since auto-merge does not update one, and the deploy checks each merge.
ruleset=$(
  cat << EOF
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": $required_checks,
        "strict_required_status_checks_policy": false
      }
    }
  ]
}
EOF
)
ruleset_id=$(gh api "repos/$repository/rulesets" --jq '.[] | select(.name == "main") | .id')
if [[ -n $ruleset_id ]]; then
  gh api --method PUT "repos/$repository/rulesets/$ruleset_id" --input - --silent <<< "$ruleset"
else
  gh api --method POST "repos/$repository/rulesets" --input - --silent <<< "$ruleset"
fi

echo "Allowing only commit-pinned actions, and read-only workflow tokens by default"
gh api --method PUT "repos/$repository/actions/permissions" \
  --field enabled=true \
  --raw-field allowed_actions=all \
  --field sha_pinning_required=true \
  --silent
gh api --method PUT "repos/$repository/actions/permissions/workflow" \
  --raw-field default_workflow_permissions=read \
  --field can_approve_pull_request_reviews=false \
  --silent

echo "Keeping the Cloudflare API token in the cloudflare environment, for main alone"
# An environment's secret reaches only the jobs that name the environment, and
# its branch policy refuses those jobs on any branch but main.
gh api --method PUT "repos/$repository/environments/cloudflare" --input - --silent << EOF
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
branch_policies=$(gh api "repos/$repository/environments/cloudflare/deployment-branch-policies" --jq '.branch_policies[].name')
if ! grep --quiet --line-regexp main <<< "$branch_policies"; then
  gh api --method POST "repos/$repository/environments/cloudflare/deployment-branch-policies" \
    --raw-field name=main --raw-field type=branch --silent
fi

echo "Checking the Cloudflare API token"
environment_secrets=$(gh secret list --env cloudflare --repo "$repository" --json name --jq '.[].name')
if ! grep --quiet --line-regexp CLOUDFLARE_API_TOKEN <<< "$environment_secrets"; then
  # A named import fails at once if the export is renamed.
  renewal=$(node --input-type=module --eval 'import { CLOUDFLARE_TOKEN_RENEWAL } from "./scripts/cloudflare-token.ts"; console.log(CLOUDFLARE_TOKEN_RENEWAL);')
  echo "The cloudflare environment's secret CLOUDFLARE_API_TOKEN is missing, so the worker cannot deploy. $renewal" >&2
  exit 1
fi

echo "Done: $repository is set up."
