# bf-11s: sun-sim EventSource and Sensor Verification

## Summary

Commit bc8df73 in jedarden/declarative-config already implements the complete sun-sim EventSource entry and Sensor configuration as specified in the bead requirements. This note confirms the implementation is correct and the bead can be closed.

## Verification Results

### 1. github-eventsource.yml (lines 305-325)

✓ **sun-sim entry** present with all required fields:
- owner: jedarden
- names: [sun-sim]
- endpoint: /sun-sim
- port: 12000
- url: https://webhooks-ci.ardenone.com
- events: [push]
- apiToken: github-webhook-secret / token
- webhookSecret: github-webhook-secret / webhook-secret
- insecure: false
- active: true
- contentType: json

✓ **webhook-registration-retry annotation** bumped to "2026-07-28T19:25:27Z" (line 21)

### 2. sun-sim-sensor.yml (complete file)

✓ **Sensor configuration** matches requirements:
- name: sun-sim-sensor
- namespace: argo-events
- dependency: eventSourceName github-webhooks / eventName sun-sim
- filters:
  - headers.X-Github-Event == push
  - body.ref == refs/heads/main
  - **CRITICAL**: body.head_commit.message != "^ci: auto-bump" (regex, filters MESSAGE not author)
- trigger: argoWorkflow submit
- generateName: sun-sim-build-
- workflowTemplateRef: sun-sim-build
- parameters: git-repo=jedarden/sun-sim, branch=main

### 3. Cascade Guard Implementation

The cascade guard correctly filters on `body.head_commit.message` with comparator `!=` and regex value `^ci: auto-bump`, NOT on author name. This is the correct approach because:

- resolve-version authors the bump commit as jedarden (repo git identity)
- palm-reading's author-name guard ("Argo Workflows CI") would NOT catch it
- Filtering on the commit message prevents cascade loops

### 4. Git Status

✓ Commit bc8df73 exists in origin/main (already pushed)

## Conclusion

All acceptance criteria are met. The implementation is correct and complete.
