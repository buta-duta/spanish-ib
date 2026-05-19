export { getGemini, MODEL_FLASH, MODEL_PRO, MODEL_TTS } from "./client.js";
export {
  completeChat,
  streamChat,
  type ChatMessage,
  type ChatRole,
} from "./chat.js";
export { generateImageBuffer, editImages } from "./image/index.js";
export { batchProcess, batchProcessWithSSE, isRateLimitError, type BatchOptions } from "./batch/index.js";
