// dto/analysis-result.dto.ts

export interface TranscriptSegment {
  text: string;
  start_time: number;
  end_time: number;
  speaker: string | null;
  ai_probability: number; // Individual sentence AI probability (0-1)
}

export interface PerplexityMetrics {
  overall_perplexity: number;
  average_perplexity: number;
  burstiness: number;
}

export interface SentenceStats {
  total_sentences: number;
  ai_sentences: number;
  human_sentences: number;
  neutral_sentences: number;
  average_sentence_ai_probability: number;
}

export interface OverallAnalysisResult {
  overall_ai_probability: number;
  overall_prediction: string;
  confidence_level: 'high' | 'medium' | 'low';
  decision_rationale: string;
  perplexity_metrics: PerplexityMetrics;
  sentence_stats: SentenceStats;
}

export interface FullScriptAnalysis {
  full_script: string; // Complete transcript text
  full_script_length: number; // Character count
  full_script_word_count: number; // Word count
  custom_model_response: {
    perplexity: number;
    perplexity_per_line: number;
    burstiness: number;
    label: number; // 0 = AI, 1 = Human
    raw_analysis: string;
  };
}

export class AnalysisResultDto {
  id: string;
  videoUrl: string;
  screenshotPath: string;
  transcript: TranscriptSegment[]; // Individual sentences with ai_probability
  overallAnalysis?: OverallAnalysisResult; // Overall analysis combining both methods
  fullScriptAnalysis?: FullScriptAnalysis; // Full script analysis details
  createdAt: Date;
  status: 'processing' | 'completed' | 'error';
  error?: string;
}