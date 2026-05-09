/**
 * 메시지 길이 제한 자동 분할 유틸리티
 * Manus 시스템의 4,000자 메시지 제한을 우회하기 위해
 * 긴 메시지를 자동으로 파일로 분할하고 첨부 경로를 반환합니다.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const MESSAGE_LIMIT = 4000;
const CHUNK_SIZE = 3800; // 안전 마진 200자
const STORAGE_DIR = '/home/ubuntu/dogolf/docs/message-chunks';

interface SplitResult {
  mainMessage: string;
  attachments: string[];
  isSplit: boolean;
}

/**
 * 메시지를 분할하고 필요시 파일로 저장합니다.
 * @param message 원본 메시지
 * @param prefix 파일명 접두사 (선택)
 * @returns { mainMessage, attachments, isSplit }
 */
export function splitMessageIfNeeded(message: string, prefix = 'response'): SplitResult {
  // 메시지 길이가 제한 내이면 그대로 반환
  if (message.length <= MESSAGE_LIMIT) {
    return {
      mainMessage: message,
      attachments: [],
      isSplit: false,
    };
  }

  // 디렉토리 생성
  try {
    mkdirSync(STORAGE_DIR, { recursive: true });
  } catch (err) {
    console.warn('Failed to create storage directory:', err);
  }

  const attachments: string[] = [];
  const chunks: string[] = [];

  // 메시지를 청크로 분할
  let remaining = message;
  let chunkIndex = 0;

  while (remaining.length > 0) {
    const chunk = remaining.substring(0, CHUNK_SIZE);
    remaining = remaining.substring(CHUNK_SIZE);
    chunks.push(chunk);
    chunkIndex++;
  }

  // 첫 번째 청크는 메인 메시지에 포함
  const mainMessage = chunks[0] + `\n\n[계속됨... 총 ${chunks.length}개 파일]`;

  // 나머지 청크는 파일로 저장
  for (let i = 1; i < chunks.length; i++) {
    const filename = `${prefix}-part${i}-${randomBytes(4).toString('hex')}.md`;
    const filepath = join(STORAGE_DIR, filename);

    try {
      writeFileSync(filepath, chunks[i], 'utf-8');
      attachments.push(filepath);
    } catch (err) {
      console.error(`Failed to write chunk file ${filename}:`, err);
    }
  }

  return {
    mainMessage,
    attachments,
    isSplit: true,
  };
}

/**
 * 응답 객체에 메시지 분할 처리를 적용합니다.
 * @param response 원본 응답 객체
 * @param messageField 메시지 필드명 (기본값: 'response')
 * @returns 분할 처리된 응답 객체
 */
export function applyMessageSplit(
  response: Record<string, any>,
  messageField = 'response'
): { response: Record<string, any>; attachments: string[] } {
  const message = response[messageField];

  if (typeof message !== 'string') {
    return { response, attachments: [] };
  }

  const { mainMessage, attachments, isSplit } = splitMessageIfNeeded(message);

  return {
    response: {
      ...response,
      [messageField]: mainMessage,
      _isSplit: isSplit,
      _attachmentCount: attachments.length,
    },
    attachments,
  };
}

/**
 * 메시지 길이 체크 (디버깅용)
 */
export function checkMessageLength(message: string): {
  length: number;
  isOverLimit: boolean;
  percentage: number;
} {
  return {
    length: message.length,
    isOverLimit: message.length > MESSAGE_LIMIT,
    percentage: Math.round((message.length / MESSAGE_LIMIT) * 100),
  };
}
