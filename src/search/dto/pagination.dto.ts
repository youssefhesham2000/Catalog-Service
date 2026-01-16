import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base pagination DTO with cursor-based pagination support
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor for next page (from previous response)',
    example: 'eyJzb3J0IjpbMTIzNDU2LCJwcm9kXzEyMyJdfQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/**
 * Cursor payload structure (encoded as base64)
 */
export interface CursorPayload {
  /**
   * Sort values from last document for search_after
   */
  sort: (string | number)[];
}

/**
 * Encode cursor payload to base64 string
 * @param payload - Cursor payload object
 * @returns Base64 encoded cursor string
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decode cursor string to payload object
 * @param cursor - Base64 encoded cursor string
 * @returns Decoded cursor payload or null if invalid
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(json) as CursorPayload;
  } catch {
    return null;
  }
}
