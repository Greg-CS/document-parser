export type TourStep = {
  selector: string;
  content: string;
};

export type TourId = "upload" | "disputes" | "letter" | "snail_mail";

export const TOUR_VERSION = 1;

export function getTourSteps(tourId: TourId): TourStep[] {
  if (tourId === "upload") {
    return [
      {
        selector: "[data-tour='upload:card']",
        content: "Upload your TransUnion, Experian, and Equifax reports here. You can upload one or all three.",
      },
      {
        selector: "[data-tour='upload:dropzone']",
        content: "Drag & drop your files or click to pick files.",
      },
      {
        selector: "[data-tour='upload:saved-imports']",
        content: "If you already uploaded reports before, pick a saved import to continue.",
      },
    ];
  }

  if (tourId === "disputes") {
    return [
      {
        selector: "[data-tour='report:tabs']",
        content: "This report view is organized into tabs. We'll focus on Disputes.",
      },
      {
        selector: "[data-tour='tab:disputes']",
        content: "Open the Disputes tab to review negative items and discrepancies.",
      },
      {
        selector: "[data-tour='disputes:summary']",
        content: "Start here: high severity items first (collections, charge-offs, 90+ days late).",
      },
      {
        selector: "[data-tour='disputes:list']",
        content: "Pick a dispute item to view details. You can also filter by severity or search.",
      },
      {
        selector: "[data-tour='disputes:view-details']",
        content: "Open details to see AI analysis and choose dispute reasons to add to your letter.",
      },
    ];
  }

  if (tourId === "letter") {
    return [
      {
        selector: "[data-tour='letter:section']",
        content: "This is your letter builder. Items you select from Disputes flow into this section.",
      },
      {
        selector: "[data-tour='letter:generate']",
        content: "Generate the letter (AI-assisted). If AI fails, the template will be used.",
      },
      {
        selector: "[data-tour='letter:preview']",
        content: "Review the letter text for accuracy and completeness before mailing.",
      },
      {
        selector: "[data-tour='letter:from']",
        content: "Make sure your name and mailing address are correct.",
      },
    ];
  }

  return [
    {
      selector: "[data-tour='snailmail:checklist']",
      content:
        "Before you mail: print your packet, sign it, and keep proof of mailing. Then mark the round as Sent.",
    },
    {
      selector: "[data-tour='disputes:round-status']",
      content:
        "After you mail, set the current round status to Sent and add the date. Expect an investigation response window.",
    },
    {
      selector: "[data-tour='snailmail:print']",
      content: "Print your letter + the mailing checklist as one packet.",
    },
  ];
}
