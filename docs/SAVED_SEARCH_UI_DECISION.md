# Saved search UI product decision

Decision: show the demand capture action only in zero-result states.

Reason:

- It avoids adding noise when the marketplace already has results.
- It turns frustration into a useful signal.
- It lets Wetudy learn demand before building notification jobs.

Next technical step:

- Add a scheduled matcher that finds new listings matching saved searches.
- Only then enable email copy that promises notifications.
