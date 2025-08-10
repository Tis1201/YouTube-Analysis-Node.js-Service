import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AnalysisResultDto, TranscriptSegment } from './dto/analysis-result.dto';
import { AnalyzeVideoDto } from './dto/analyze-video.dto';
import { join } from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as ytdl from '@distube/ytdl-core';
import puppeteer from 'puppeteer';
import axios from 'axios';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as ffmpeg from 'fluent-ffmpeg';
import { Blob } from 'buffer';

interface OverallAnalysis {
  overall_ai_probability: number;
  overall_prediction: string;
  confidence_level: 'high' | 'medium' | 'low';
  decision_rationale: string;
  perplexity_metrics: { overall_perplexity: number; average_perplexity: number; burstiness: number };
  sentence_stats: {
    total_sentences: number;
    ai_sentences: number;
    human_sentences: number;
    neutral_sentences: number;
    average_sentence_ai_probability: number;
  };
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly results = new Map<string, AnalysisResultDto>();
  private readonly elevenLabsClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  private readonly uploadsDir = join(process.cwd(), 'temp');
  private readonly cache = new Map<string, number>();

  constructor() {
    fs.mkdir(this.uploadsDir, { recursive: true });
  }

  async analyzeVideo(dto: AnalyzeVideoDto): Promise<{ id: string }> {
    if (!ytdl.validateURL(dto.url)) throw new BadRequestException('Invalid YouTube URL');

    const id = uuidv4();
    this.results.set(id, {
      id,
      videoUrl: dto.url,
      screenshotPath: '',
      transcript: [],
      createdAt: new Date(),
      status: 'processing',
    });

    this.processVideo(id, dto.url).catch((error) => {
      const result = this.results.get(id);
      if (result) {
        result.status = 'error';
        result.error = error.message;
      }
    });

    return { id };
  }

  async getResult(id: string): Promise<AnalysisResultDto> {
    const result = this.results.get(id);
    if (!result) throw new BadRequestException('Analysis not found');

    // Wait up to 3 minutes for processing
    const startTime = Date.now();
    while (result.status === 'processing' && Date.now() - startTime < 180000) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (result.status === 'processing') throw new BadRequestException('Analysis timeout');
    if (result.status === 'error') throw new BadRequestException(`Analysis failed: ${result.error}`);

    return result;
  }

  private async processVideo(id: string, videoUrl: string) {
    const result = this.results.get(id);
    if (!result) return;

    try {
      const [screenshotUrl, audioPath] = await Promise.all([
        this.captureScreenshot(videoUrl),
        this.extractAudio(videoUrl, id),
      ]);

      result.screenshotPath = screenshotUrl;
      const transcript = await this.transcribeAudio(audioPath);
      const segments = await this.analyzeTranscript(transcript);

      result.transcript = segments;
      result.overallAnalysis = this.calculateOverallAnalysis(segments);
      result.status = 'completed';

      fs.unlink(audioPath).catch(() => {});
    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }
  }

  private async captureScreenshot(videoUrl: string): Promise<string> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const screenshot = await page.screenshot({ type: 'png' });
      return await this.uploadToImgBB(screenshot);
    } catch (error) {
      this.logger.error(`Screenshot failed: ${error.message}`);
      return 'https://via.placeholder.com/1280x720/ff4444/ffffff?text=Screenshot+Failed';
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  private async uploadToImgBB(buffer: Buffer): Promise<string> {
    try {
      const { data } = await axios.post('https://api.imgbb.com/1/upload', 
        new URLSearchParams({
          key: process.env.IMGBB_API_KEY!,
          image: buffer.toString('base64'),
          expiration: process.env.IMGBB_EXPIRATION || '0',
        }), 
        { 
          timeout: 30000,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (data?.success) {
        this.logger.log(`Image uploaded: ${data.data.url}`);
        return data.data.url;
      }
      throw new Error(data?.error?.message || 'Upload failed');
    } catch (error) {
      this.logger.error(`ImgBB upload error: ${error.message}`);
      return 'https://via.placeholder.com/1280x720/ff4444/ffffff?text=Upload+Failed';
    }
  }

  private extractAudio(videoUrl: string, id: string): Promise<string> {
    const outputPath = join(this.uploadsDir, `${id}.wav`);
    return new Promise((resolve, reject) => {
      ffmpeg(ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' }))
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .format('wav')
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  private async transcribeAudio(audioPath: string): Promise<any> {
    const audioBuffer = await fs.readFile(audioPath);
    return await this.elevenLabsClient.speechToText.convert({
      modelId: 'scribe_v1',
      file: new Blob([audioBuffer], { type: 'audio/wav' }),
    });
  }

  private async analyzeTranscript(transcript: any): Promise<TranscriptSegment[]> {
    const words = transcript.words || transcript.segments || [];
    if (!words.length) return [];

    const text = words.map(w => w.word || w.text || '').join(' ');
    const aiProbability = await this.getAIProbability(text);

    return words.map(word => ({
      text: word.word || word.text || '',
      start_time: word.start_time || word.start || 0,
      end_time: word.end_time || word.end || 0,
      speaker: word.speaker || null,
      ai_probability: aiProbability,
    }));
  }

  private calculateOverallAnalysis(segments: TranscriptSegment[]): OverallAnalysis {
    const avgProb = segments.reduce((sum, s) => sum + s.ai_probability, 0) / (segments.length || 1);
    const aiCount = segments.filter(s => s.ai_probability >= 0.7).length;
    const humanCount = segments.filter(s => s.ai_probability <= 0.3).length;

    return {
      overall_ai_probability: avgProb,
      overall_prediction: avgProb >= 0.7 ? 'AI-Generated Content' 
        : avgProb >= 0.5 ? 'Mixed Content' : 'Human-Generated Content',
      confidence_level: (aiCount > segments.length * 0.8 || humanCount > segments.length * 0.8) 
        ? 'high' : 'medium',
      decision_rationale: `${aiCount} AI-like, ${humanCount} human-like segments`,
      perplexity_metrics: { overall_perplexity: 0, average_perplexity: 0, burstiness: 0 },
      sentence_stats: {
        total_sentences: segments.length,
        ai_sentences: aiCount,
        human_sentences: humanCount,
        neutral_sentences: segments.length - aiCount - humanCount,
        average_sentence_ai_probability: avgProb,
      },
    };
  }

  private async getAIProbability(text: string): Promise<number> {
    if (text.length < 50) return 0.5;

    const hash = this.hashString(text);
    if (this.cache.has(hash)) return this.cache.get(hash)!;

    try {
      const { data } = await axios.post(
        process.env.AI_DETECTION_URL || 'https://huggingface.co/spaces/skyoi1212/ai-detection',
        { sentence: text },
        { timeout: parseInt(process.env.AI_DETECTION_TIMEOUT || '15000') }
      );

      const probability = data.output.label === 0 ? 0.8 : 0.2;
      this.cache.set(hash, probability);
      return probability;
    } catch {
      return 0.5;
    }
  }

  private hashString(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(36);
  }
}