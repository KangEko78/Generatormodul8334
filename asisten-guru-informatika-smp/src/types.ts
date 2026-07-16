export interface PresetTopic {
  id: string;
  grade: "VII" | "VIII" | "IX";
  title: string;
  element: "BK" | "SK" | "JKI" | "AD" | "AP" | "DSI" | "PLB" | "AI";
  description: string;
}

export interface ModulAjar {
  id: string;
  title: string;
  grade: "VII" | "VIII" | "IX";
  materi: string;
  model: string;
  semester: string;
  alokasi: string;
  content: string;
  customDirectives?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
}
