/** Public profile path: the custom URL (/@handle) when set, else /profiles/{id}. */
export function profileHref(user: { id: number; handle?: string | null }): string {
  return user.handle ? `/@${user.handle}` : `/profiles/${user.id}`;
}
