export type Did = `did:${string}`;
export type AtHandle = `${string}.${string}`;

export interface ActorIdentity {
  did: Did;
  handle: AtHandle;
  displayName?: string;
  avatarUrl?: string;
  trustScore: number;
}
