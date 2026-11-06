export type DocumentKind = "pdf" | "docx" | "pptx";
export type PassageLocator = "page" | "slide" | "section";

export type ExtractedPassage = {
  locatorType: PassageLocator;
  locatorLabel: string;
  content: string;
};

export type ExtractionResult = {
  passages: ExtractedPassage[];
  pageCount: number | null;
  extractedChars: number;
  warning: string | null;
};
