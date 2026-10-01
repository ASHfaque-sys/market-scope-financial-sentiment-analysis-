"use client";

import type { Sentiment } from './stocks';

type Score = { label: string; score: number };
type Classifier = (texts: string | string[], options: Record<string, unknown>) => Promise<Score[] | Score[][]>;
let classifierPromise: Promise<Classifier> | undefined;

async function getClassifier(onProgress?: (message: string) => void): Promise<Classifier> {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      onProgress?.('Loading FinBERT for the first time…');
      const { env, pipeline } = await import('@huggingface/transformers');
      const progress_callback = (event: { status?: string; progress?: number }) => {
        if (event.status === 'progress' && typeof event.progress === 'number') {
          onProgress?.(`Loading FinBERT ${Math.round(event.progress)}%`);
        }
      };
      let result: any;
      try {
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.localModelPath = '/models/';
        result = await pipeline('text-classification', 'finbert', {
          device: 'wasm',
          dtype: 'q8',
          progress_callback,
        });
      } catch {
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        result = await pipeline('text-classification', 'Xenova/finbert', {
          device: 'wasm',
          dtype: 'q8',
          progress_callback,
        });
      }
      return result as unknown as Classifier;
    })().catch(error => {
      classifierPromise = undefined;
      throw error;
    });
  }
  return classifierPromise;
}

export async function classifyFinbert(texts: string[], onProgress?: (message: string) => void): Promise<Sentiment[]> {
  if (!texts.length) return [];
  const classifier = await getClassifier(onProgress);
  const results: Sentiment[] = [];
  for (let start = 0; start < texts.length; start += 4) {
    const slice = texts.slice(start, start + 4);
    const raw = await classifier(slice, { top_k: 3, truncation: true, max_length: 128 });
    const batches = raw as Score[][];
    if (!Array.isArray(batches) || batches.length !== slice.length || !Array.isArray(batches[0])) {
      throw new Error('FinBERT returned an unexpected result.');
    }
    for (const scores of batches) {
      const probabilities = Object.fromEntries(scores.map(({ label, score }) => [label.toLowerCase(), score]));
      const [label, confidence] = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0] || ['neutral', 0];
      results.push({
        label, confidence, probabilities,
        relevant: true,
        lowConfidence: confidence < .60,
        coverage: 1,
        evidence: [],
        model: 'FinBERT',
        note: 'FinBERT reads the headline in context. Its probabilities are uncalibrated and do not verify the news or predict returns.',
      });
    }
  }
  return results;
}
