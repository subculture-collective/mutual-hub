# Chat Routing Rules (Phase 5)

Deterministic routing is used for post-linked 1:1 chat handoff decisions. The decision engine must produce the same output for the same inputs and always emit explainable rationale.

## Priority order

1. **Direct post author (`post_author`)**
    - Conditions:
        - requester DID differs from post author DID
        - post author is reachable
        - post author path is not blocked by policy
2. **Verified volunteer pool (`volunteer_pool`)**
    - Conditions:
        - verified volunteer
        - volunteer accepts chat
        - volunteer supports the post category
    - Tie-break order:
        1. nearest distance
        2. most recent activity
        3. DID lexical order
3. **Verified resource directory (`resource_directory`)**
    - Conditions:
        - verified resource
        - resource accepts intake
        - category support (if provided)
    - Tie-break order:
        1. explicit priority (ascending)
        2. resource type lexical order
        3. resource id lexical order
4. **Manual review fallback (`manual_review`)**
    - Used when no deterministic destination is eligible.

## Explainability contract

Each route decision returns:

- **Machine rationale**
    - selected rule id
    - selected priority
    - ordered rule trace list (`matched`, `detail`, optional candidate id)
- **Human rationale**
    - concise sentence describing why this destination was selected

## Transport capability fallback

When recipient AT-native transport is unavailable:

- route metadata includes `transportMode = fallback_notice`
- fallback reason is explicit (`recipient_unsupported`, `recipient_opt_out`, `recipient_unreachable`)
- user-facing notice must clearly state that AT-native delivery is not possible and safe fallback is required

## Example outcomes

- Direct helper available → `post_author`
- Helper unavailable, verified volunteer exists → `volunteer_pool`
- No volunteer match, verified intake resource exists → `resource_directory`
- No eligible destination → `manual_review`
