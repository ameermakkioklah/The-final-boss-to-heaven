# Security Specification — Warrior vs Dragon Live Leaderboard

## 1. Data Invariants
1. A `players/{playerId}` document can only be created or updated by the verified authenticated owner (`request.auth.uid == playerId && request.auth.token.email_verified == true`), with zero PII stored.
2. On creation of `players/{playerId}`, `dragonKills == 0`, `wins == 0`, `losses == 0`, `matchesPlayed == 0`, `bestTimeMs == null`, `lastOutcome == 'none'`, and `createdAt == updatedAt == request.time`.
3. `dragonKills` MUST always equal `wins`, and `matchesPlayed` MUST always equal `wins + losses`.
4. `dragonKills` and `wins` can ONLY increment by `+1` on a win update, and `bestTimeMs` can NEVER be populated or improved by a loss.
5. Every `matches/{matchId}` creation MUST occur atomically in the same batch as an increment (`+1`) to the owner's `players/{uid}.matchesPlayed`, enforced via `getAfter` + `get`.
6. `matches/{matchId}` records are immutable terminal logs (`update` and `delete` denied).

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Creating `players/attacker` without `request.auth`.
2. **Unverified Email Spoof**: Writing `players/{uid}` when `request.auth.token.email_verified == false`.
3. **Cross-Owner Impersonation**: User A updating `players/{userB}`.
4. **Shadow Ghost Field**: Creating `players/{uid}` with extra field `isAdmin: true`.
5. **Inflated Initial Kills**: Creating `players/{uid}` with `dragonKills: 999`.
6. **Multi-Kill Increment Cheat**: Updating `players/{uid}` with `dragonKills: existing.dragonKills + 5`.
7. **Loss Recording Fake Kill**: Updating `players/{uid}` with `lastOutcome: 'loss'` while incrementing `dragonKills` or changing `bestTimeMs`.
8. **Fake Best Time Override**: Updating `players/{uid}` on win with `bestTimeMs: 100` (below minimum 3000ms or mismatching `lastDurationMs` when faster).
9. **Client Timestamp Forgery**: Creating `players/{uid}` or `matches/{matchId}` with client-supplied past/future `createdAt != request.time`.
10. **Immortal Field Mutation**: Updating `players/{uid}` to alter `uid` or `createdAt`.
11. **Orphan Match Injection**: Creating `matches/{matchId}` without atomically incrementing `players/{uid}.matchesPlayed`.
12. **ID Poisoning / XSS Name**: Creating `matches/../../hack` or setting `playerName: "<script>alert(1)</script>"` or >20 chars.
