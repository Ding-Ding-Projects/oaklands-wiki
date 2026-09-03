# Toy locks and the unlock ladder

## It is just for fun

This is a self-imposed speed bump. It is **not encryption**, it secures nothing,
and it is no protection from anyone else using the same browser. Every surface
says so, and none of them describes it otherwise.

## Behaviour

Right-click any element to lock it. Six policies: PIN, password, PIN plus
password, password plus one-time code, PIN plus one-time code, and all three.

Each lock carries its **own** policy and its **own** credentials. There is no
master credential and no inheritance: unlocking one element never unlocks
another. Two elements sharing a PIN got there because somebody typed it twice.

A locked element is genuinely inert. Interception runs at the document level in
the capture phase, so a keyboard press or a programmatic click cannot walk around
a disabled attribute.

An unlock lasts as long as the visitor chose: this surface only, a number of
minutes, or until the browser closes.

## Credentials

Passwords and PINs are verified against a SHA-256 hash; nothing is stored in the
clear. One-time codes are RFC 6238 TOTP from a secret the visitor supplies from
their own authenticator -- nothing is generated, mailed or texted here.

A wrong attempt never characterises the stored value: not its length, not its
composition, not how close the attempt was.

## The unlock ladder

A lockout is the one moment a product has nothing to offer: a countdown, and a
person watching it. The ladder replaces the watching.

1. **Dim sum** -- one dish, four choices.
2. **Ten easy sums**, after five wrong dishes.
3. **Whack-a-mole**, after a lost round of sums.
4. **The clock**, after a lost round. The ladder is not offered again.

Falling to the bottom leaves the visitor exactly where they started, so the
ladder can only improve a locked-out afternoon.

### What it must never do

- It clears the **waiting**, never the **credential**. Winning returns you to the
  ordinary prompt and you still need your PIN.
- It never refunds the attempt budget.
- It is capped at **three skipped waits per rolling hour**. Four choices is
  one-in-four and a mole schedule is arithmetic; without the cap a script plays
  past every lockout and brute force gets cheaper, which is the single thing a
  lockout exists to prevent.
- It never slows the exponential escalation it skips.

A mole hit counts only against a mole genuinely visible in that cell, once, and
the round cannot be won faster than its own duration.

Under School mode the dim-sum rung is **absent** rather than skipped with a
message, because a message naming the hidden thing is what School mode forbids.
One function decides the first rung so no surface can get it wrong locally.

## Recovery

Forgetting a credential is a normal outcome for a toy. Clearing this site's
storage removes every lock. There is no reset ticket and no support channel,
because there is nothing to reset on any server -- and **Support Tickets** says
exactly that, in one plain line outside the comedy, before it opens the same
storage-clearing button.

## Verification

`scripts/test-locks.mjs` checks the base32 round trip, three published RFC 6238
SHA-1 vectors, and the ladder budget including its rolling-window expiry.

## Suggested articles

- [The authenticator](authenticator.md)
- [Language modes and funny levels](language-and-funny-levels.md)
