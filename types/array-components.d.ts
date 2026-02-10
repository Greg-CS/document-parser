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

  /**
   * Web components only read lowercase HTML attributes.
   * We declare both camelCase (for readability) and lowercase (what the SDK actually reads).
   * Use the lowercase variants to ensure the SDK receives them.
   */
  interface ArrayBaseAttributes
    extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> {
    appKey?: string
    appkey?: string
    userToken?: string
    usertoken?: string
    apiUrl?: string
    apiurl?: string
    sandbox?: string | boolean
  }

  interface ArrayAccountLoginAttributes extends ArrayBaseAttributes {
    heading?: string
  }

  interface ArrayAccountEnrollAttributes extends ArrayBaseAttributes {
    showQuickView?: string | boolean
    showquickview?: string | boolean
  }

  interface ArrayAuthenticationKbaAttributes extends ArrayBaseAttributes {
    userId?: string
    userid?: string
    showResultPages?: string | boolean
    showresultpages?: string | boolean
  }

  interface ArrayWebComponentAttributes extends ArrayBaseAttributes {
    widget?: string
  }

  interface WindowEventMap {
    "array-event": CustomEvent<ArrayEventDetail>
  }

  namespace JSX {
    interface IntrinsicElements {
      "array-account-login": ArrayAccountLoginAttributes
      "array-account-enroll": ArrayAccountEnrollAttributes
      "array-authentication-kba": ArrayAuthenticationKbaAttributes
      "array-web-component": ArrayWebComponentAttributes
    }
  }
}
