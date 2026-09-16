/*
Release Workflow — .github/workflows/release.yml
==================================================

(Release mechanics are language-agnostic; the test step here runs `npm test`.
See workflows/release.yml for a complete example.)

--- SEMANTIC VERSIONING ---

  vMAJOR.MINOR.PATCH — MAJOR: breaking · MINOR: feature (compatible) · PATCH: fix.
  v0.x: pre-1.0, no guarantees · v1.0.0: first stable · pre-release: v1.0.0-rc.1.

--- GIT TAGS ---

  git tag v1.2.3                              # lightweight
  git tag -a v1.2.3 -m "Release v1.2.3"       # annotated (recommended)
  git push origin v1.2.3
  git tag -d v1.2.3 ; git push origin :v1.2.3 # delete local / remote

--- TRIGGER ---

  on: { push: { tags: ["v*.*.*"] } }
Matches v1.0.0, v0.2.1, v10.0.0-rc.1. A branch named "v1.0.0" does NOT match
(tags and branches are distinct refs).

--- RUN TESTS BEFORE RELEASING ---

The tag/release should only exist if THIS commit passes. main may have moved
between CI going green and you tagging, so release.yml re-runs `npm test` as the
final gate, then creates the GitHub Release only on success.

--- AUTO-GENERATED RELEASE NOTES ---

  - uses: softprops/action-gh-release@v2
    with: { generate_release_notes: true }
GitHub groups merged PRs by label. Configure categories in .github/release.yml.

--- PERMISSIONS ---

  permissions: { contents: write }   # least privilege; needed to create a release
GITHUB_TOKEN is auto-provisioned per run (read-only by default).

--- EXTRACT THE VERSION ---

  - run: echo "VERSION=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"
GITHUB_REF_NAME is "v1.2.3"; #v strips the prefix → "1.2.3". Use it for npm
package versions, Docker tags, release text: ${{ steps.version.outputs.VERSION }}.

--- GITHUB RELEASE vs GIT TAG ---

A tag points at a commit. A GitHub Release is a UI object on top of a tag with a
title, markdown body, attached artifacts, and a "latest"/"pre-release" marker.

--- EXERCISES ---

  1. git tag v0.1.0 && git push origin v0.1.0 → watch release.yml; check /releases.
  2. draft: true → review before publishing.
  3. prerelease: ${{ contains(github.ref_name, '-') }} → rc/beta auto-marked.
  4. attach an artifact: action-gh-release `files:` with a built tarball
     (e.g. `npm pack` output).
*/
export {};
