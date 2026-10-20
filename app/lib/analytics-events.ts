/**
 * Action catalog for the Vercel Web Analytics Events panel.
 * Filter by `user_id` / `signed_in` there to see which users take which actions.
 */
export const AnalyticsEvent = {
  AuthLoginOpened: 'Auth Login Opened',
  AuthLoginLinkSent: 'Auth Login Link Sent',
  AuthSignedIn: 'Auth Signed In',
  AuthSignedOut: 'Auth Signed Out',
  AuthGate: 'Auth Gate',
  MapSegmentOpened: 'Map Segment Opened',
  MapSearchSelected: 'Map Search Selected',
  MapTimeOverride: 'Map Time Override',
  MapLayerToggled: 'Map Layer Toggled',
  CrowdSuggestMode: 'Crowd Suggest Mode',
  CrowdTowMode: 'Crowd Tow Mode',
  CrowdCorrectionsOpened: 'Crowd Corrections Opened',
  CrowdSpotSuggested: 'Crowd Spot Suggested',
  CrowdTowReported: 'Crowd Tow Reported',
  CrowdRuleConfirmed: 'Crowd Rule Confirmed',
  CrowdProblemReported: 'Crowd Problem Reported',
  UiLanguageSwitched: 'UI Language Switched',
  UiMenuToggled: 'UI Menu Toggled',
  UiQuickAction: 'UI Quick Action'
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];
