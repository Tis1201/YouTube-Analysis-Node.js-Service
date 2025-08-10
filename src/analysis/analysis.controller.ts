import { Controller, Get, Post, Body, Param, BadRequestException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalyzeVideoDto } from './dto/analyze-video.dto';
import { AnalysisResultDto } from './dto/analysis-result.dto';

@Controller()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('analyze')
  async analyzeVideo(@Body() analyzeVideoDto: AnalyzeVideoDto): Promise<{ id: string }> {
    try {
      return await this.analysisService.analyzeVideo(analyzeVideoDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('result/:id')
  async getResult(@Param('id') id: string): Promise<AnalysisResultDto> {
    try {
      return await this.analysisService.getResult(id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string): Promise<{ status: string; error?: string }> {
    try {
      const result = await this.analysisService.getResult(id);
      return {
        status: result.status,
        error: result.error
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}