# Task bf-3gw: Add sun-sim entry to github-eventsource.yml

## Status: Already Completed

This task requested adding the sun-sim entry to `jedarden/declarative-config k8s/iad-ci/argo-events/github-eventsource.yml`. Upon investigation, the entry was **already added on 2026-07-22** in commit `bc8df73b`.

## Verification of Acceptance Criteria

### ✅ 1. File committed and pushed to declarative-config
- Commit: `bc8df73b` (2026-07-22 01:34:54)
- Author: jedarden
- Message: "ci(sun-sim): wire Argo Events webhook trigger (EventSource + Sensor)"
- Files changed: `k8s/iad-ci/argo-events/github-eventsource.yml` (+23 lines)

### ✅ 2. argo-events app syncs the change
- The EventSource `github-webhooks` in namespace `argo-events` contains the sun-sim entry
- Verified with: `kubectl get eventsource github-webhooks -n argo-events -o jsonpath='{.spec.github.sun-sim}'`

### ✅ 3. kubectl shows sun-sim entry in EventSource
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get eventsource github-webhooks -n argo-events
```
Output shows `sun-sim` in the `.spec.github` keys list.

### ✅ 4. Configuration matches requirements
The existing configuration matches the task requirements exactly:
- EventSource: github-webhooks ✓
- Namespace: argo-events ✓
- Owner: jedarden ✓
- Repository names: [sun-sim] ✓
- Webhook endpoint: /sun-sim ✓
- Port: 12000 ✓
- URL: https://webhooks-ci.ardenone.com ✓
- Events: [push] ✓
- apiToken/webhookSecret from github-webhook-secret ✓
- insecure: false ✓
- active: true ✓
- contentType: json ✓

## Additional Notes

- A follow-up commit `3a8fe2da` (2026-07-28 15:26:20) bumped the `webhook-registration-retry` annotation to ensure the controller registers the webhook on GitHub
- The github-webhooks EventSource pod is running: `github-webhooks-eventsource-dsbfk-5f64c6697b-8j8zv` (1/1 Running, 2m5s old)
- Cannot verify GitHub webhook registration directly (`gh` CLI not available), but the Argo Events infrastructure is properly configured and the pod restart should trigger webhook registration

## Conclusion

The task was already completed 6 days prior to this bead. All acceptance criteria have been met.
