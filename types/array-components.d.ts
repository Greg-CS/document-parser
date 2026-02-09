/**
 * Type declarations for Array.io custom web components.
 * These are loaded via <script> tags in app/layout.tsx and
 * rendered as standard HTML custom elements in JSX.
 *
 * Docs: https://docs.array.io
 */

export {}

declare global {
  /** Custom event emitted by all Array web components */
  interface ArrayEventDetail {
    tagName: string
    event: string
    metadata: Record<string, unknown>
  }

  interface ArrayBaseAttributes
    extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> {
    appKey?: string
    userToken?: string
    apiUrl?: string
    sandbox?: string | boolean
  }

  interface ArrayAccountLoginAttributes extends ArrayBaseAttributes {
    /** Override the login heading text */
    heading?: string
  }

  interface ArrayAccountEnrollAttributes extends ArrayBaseAttributes {
    /** Show the quick-view enrollment form */
    showQuickView?: string | boolean
  }

  interface ArrayWebComponentAttributes extends ArrayBaseAttributes {
    /** The specific Array widget to render */
    widget?: string
  }

  interface WindowEventMap {
    "array-event": CustomEvent<ArrayEventDetail>
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "array-account-login": ArrayAccountLoginAttributes
      "array-account-enroll": ArrayAccountEnrollAttributes
      "array-web-component": ArrayWebComponentAttributes
    }
  }
}
