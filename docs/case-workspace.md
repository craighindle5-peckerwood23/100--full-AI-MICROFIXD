# Private correspondence workspace

Open `/case-workspace`, or OS → Workspace → Open private correspondence / case workspace.

## Try now

1. Click **Try fictional demo**. These two messages are synthetic and unrelated to Craig's evidence.
2. Select visible messages, open message text, add a note, export the evidence index.
3. Click Clear & disconnect before using real records.
4. In desktop Gmail open a message → More → Download message. Import the resulting `.eml` files. MIME is parsed locally; originals remain downloadable. Export the review before closing the page.

## Gmail authorization

This application's authorization is independent of ChatGPT's Gmail connector.
Create a Google Cloud Web OAuth client, enable Gmail API, configure the consent screen and add the exact HTTPS website origin to Authorized JavaScript origins. During Testing, add `craighindle5@gmail.com` as a test user. Google's restricted-scope policies may require verification for broader distribution.

Supply the public client ID in the workspace or `VITE_GOOGLE_CLIENT_ID` at build time. No client secret or refresh token is used. Click Load Google sign-in → Authorize Gmail read access → Search Gmail. Only `gmail.readonly` is requested. Profile email is checked before any messages are read; this version intentionally supports only the settlement account. Tokens and loaded messages remain in browser memory. There is no background synchronization. Connect again after token expiration.

Search returns 20 messages per page, with explicit next-page loading and deduplication by message ID. The default excludes drafts; other searches may include drafts, visibly marked. Query changes reset the page cursor but previously loaded evidence remains until cleared. Keyword topics are review aids. Gmail HTML-only bodies are not rendered; review them in Gmail. Attachments are indexed by filename, not downloaded or analyzed. No sending, mailbox mutation, AI processing, legal conclusions, or automated no-response assertions.

## Storage and limits

Gmail is the durable original source. Imported EML files are session-only working copies; there is no local JSON storage fallback and no claim of saved Supabase case records. The Markdown export includes selected message text and notes, not original Gmail MIME or attachment bytes. Preserve original emails and attachments separately. Exhibit numbers are assigned chronologically per export and may change when selection changes. This is a working review index, not a court filing or certified archive.

No real evidence is committed to the repository. The standalone route bypasses the optional OS account gate because it serves no shared data: each user must authorize Google or choose their own local files. Server credentials and shared mailbox tokens are not involved. Imported text is rendered as React text, never as executable HTML.

Validation: tests/casework.test.ts covers source preservation, ordering, drafts, wrong-account denial, API failures, pagination, MIME decoding. Live Google authorization requires the configured client and the account owner's consent; simulated tests do not establish live access.
