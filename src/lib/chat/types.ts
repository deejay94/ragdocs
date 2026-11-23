export type Citation = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  headingPath: string | null;
  chunkIndex: number;
  score: number;
};

export type ChatMetaEvent = {
  type: "meta";
  conversationId: string;
  grounded: boolean;
  bestScore: number | null;
  minScore: number;
  citations: Citation[];
};

export type ChatTokenEvent = {
  type: "token";
  content: string;
};

export type ChatRefusalEvent = {
  type: "refusal";
  content: string;
};

export type ChatDoneEvent = {
  type: "done";
};

export type ChatErrorEvent = {
  type: "error";
  error: string;
};

export type ChatStreamEvent =
  | ChatMetaEvent
  | ChatTokenEvent
  | ChatRefusalEvent
  | ChatDoneEvent
  | ChatErrorEvent;
