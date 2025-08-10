import { Exclude, Expose } from 'class-transformer';
import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

@Exclude()
export class AnalyzeVideoDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  url: string;
}
