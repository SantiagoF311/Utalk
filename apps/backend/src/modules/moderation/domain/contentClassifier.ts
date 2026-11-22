// Lo que se manda a revisar: el texto del post y, si tiene, su imagen.
export interface ContentToClassify {
  text: string;
  imageUrl: string | null;
}

export interface Classification {
  flagged: boolean;
  // Categorías del proveedor que se activaron (ej. "harassment", "violence/graphic").
  categories: string[];
}

// Puerto de la moderación por IA: el service pregunta sin saber que abajo
// está OpenAI.
export interface ContentClassifier {
  classify(content: ContentToClassify): Promise<Classification>;
}

export const CONTENT_CLASSIFIER = Symbol('CONTENT_CLASSIFIER');
