# Credit Report Domain

Purpose:
Represent and analyze credit data from bureaus.

Key rules:
- Reports are immutable snapshots.
- Changes are detected by comparison.
- Items must be classified (positive, negative, disputed).

Primary entities:
- CreditReport
- CreditItem
- BureauReport
