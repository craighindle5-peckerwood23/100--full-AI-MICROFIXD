# Talk to Microfixd

Open the cockpit and select **Ask Microfixd** to ask a question. Use **Run a task** to submit an objective and track its mission. You can ask a question while a task is waiting. Each view keeps its own draft and result while the cockpit is open.

Choose **Diagnose a mission**, select the mission by objective, and press **Check mission evidence**. Read the finding and suggested next step. Expand **Evidence and prior cases** to inspect the observations. **Open this mission** takes you to the existing approval, reconciliation and recovery controls.

The diagnostic reads a snapshot of the first waiting or failed subtask in execution order. If there is no such subtask, it checks the planning error record. For tool steps it chooses between the approval and run ledgers using the recorded stop. It checks the tenant, mission, subtask and request hash. Run the check again after a decision or worker transition.

A historical case needs a successful source mission, an artifact-backed step, matching tool and argument names, current tool permission and the same recorded stop on that step. Older procedure records without a subtask identifier remain available to ordinary recall. The comparison does not propose replaying historical arguments. An operator can inspect the earlier mission to assess whether its circumstances apply.

## Execute the pilot

From the feature branch with Node and npm installed:

```sh
npm ci
npm run test:diagnosis
npm run verify:production
npm run test:hio-ui
```

The replay compares the existing cockpit status summary with the diagnostic against 10 development and 10 held-out synthetic snapshots. Both see the same records, have a two-ledger budget and use zero model calls. The candidate reports targeted ledger reads and duplicates. Counts exclude mission lookup, stop-code lookup and historical memory retrieval. The browser test exercises the real diagnosis route and authorization against local fixture records.

For a manual run, configure the existing Supabase and operator credentials for a staging workspace, run `npm run dev:all`, and open `http://localhost:3000`. Sign in, select a waiting mission, and compare its displayed evidence with Mission Control. To measure recovery cost, record the starting mission ID, operator decisions, total provider usage and final verified result artifact. A classified blocker alone cannot establish recovery.
