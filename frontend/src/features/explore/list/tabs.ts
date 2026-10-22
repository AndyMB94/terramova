export type ListTab = "events" | "favorites";

export const LIST_TABS: readonly ListTab[] = ["events", "favorites"];

export function tabId(tab: ListTab): string {
  return `list-tab-${tab}`;
}

export function panelId(tab: ListTab): string {
  return `list-panel-${tab}`;
}
